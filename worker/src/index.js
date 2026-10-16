// Proxy DeepSeek + Push Notification cho Sổ Thu Chi (Cloudflare Worker).
// - Giữ API key DeepSeek ở phía máy chủ (secret DEEPSEEK_API_KEY).
// - Chỉ trả lời người đã đăng nhập Firebase bằng email nằm trong ALLOWED_EMAILS.
// - Lưu FCM push token (POST /push-token) vào KV.
// - Cron Triggers gửi nhắc lương ngày 15 và 25 qua FCM v1 API.

const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MAX_MESSAGES = 20;
const MAX_CHARS = 40000;

let jwksCache = { keys: null, exp: 0 };

async function getKeys() {
  if (jwksCache.keys && Date.now() < jwksCache.exp) return jwksCache.keys;
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error("jwks " + res.status);
  const { keys } = await res.json();
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get("cache-control") || "")?.[1] || 3600);
  jwksCache = { keys, exp: Date.now() + maxAge * 1000 };
  return keys;
}

export function b64u(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  s += "=".repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

function toB64url(bytes) {
  let s = "";
  bytes.forEach(b => s += String.fromCharCode(b));
  return btoa(s).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function objToB64url(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  return toB64url(bytes);
}

// Kiểm tra Firebase ID token (JWT RS256).
export async function verifyFirebaseToken(token, projectId, keys) {
  const parts = (token || "").split(".");
  if (parts.length !== 3) throw new Error("token format");
  const [h, p, sig] = parts;
  const dec = new TextDecoder();
  const header = JSON.parse(dec.decode(b64u(h)));
  const payload = JSON.parse(dec.decode(b64u(p)));
  if (header.alg !== "RS256") throw new Error("alg");
  const jwk = keys.find(k => k.kid === header.kid);
  if (!jwk) throw new Error("kid");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64u(sig), new TextEncoder().encode(h + "." + p));
  if (!ok) throw new Error("signature");
  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== projectId) throw new Error("aud");
  if (payload.iss !== "https://securetoken.google.com/" + projectId) throw new Error("iss");
  if (!payload.sub) throw new Error("sub");
  if (payload.exp <= now) throw new Error("expired");
  if (payload.iat > now + 300) throw new Error("iat");
  return payload;
}

// Tạo OAuth2 access token từ Service Account (dùng cho FCM v1 API).
async function getOAuthToken(clientEmail, privatePem) {
  // Parse PEM PKCS#8
  const pemBody = privatePem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const keyData = b64u(pemBody + "=".repeat((4 - pemBody.length % 4) % 4));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", keyData, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]
  );
  const now = Math.floor(Date.now() / 1000);
  const head = objToB64url({ alg: "RS256", typ: "JWT" });
  const body = objToB64url({
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600
  });
  const sigInput = new TextEncoder().encode(head + "." + body);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, sigInput);
  const jwt = head + "." + body + "." + toB64url(new Uint8Array(sig));

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=" + jwt
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("OAuth token failed: " + JSON.stringify(data));
  return data.access_token;
}

// Gửi push qua FCM v1 API (1 token mỗi lần).
async function sendFcmV1(projectId, fcmToken, title, body, url, oauthToken) {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + oauthToken },
    body: JSON.stringify({
      message: {
        token: fcmToken,
        notification: { title, body },
        webpush: {
          notification: { icon: "/icon.svg", tag: "stc-salary", renotify: true },
          fcm_options: { link: url || "/" }
        }
      }
    })
  });
  return res.json();
}

function cors(env, origin) {
  const allowed = (env.ALLOWED_ORIGIN || "").split(",").map(s => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || "");
  return {
    "Access-Control-Allow-Origin": ok ? origin : (allowed[0] || ""),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}

function json(status, body, headers) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json; charset=utf-8" } });
}

export default {
  // ---- HTTP requests ----
  async fetch(request, env) {
    const h = cors(env, request.headers.get("Origin"));
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
    if (request.method !== "POST") return json(405, { error: "Chỉ hỗ trợ POST" }, h);

    const url = new URL(request.url);

    // ---- POST /push-token: lưu FCM token ----
    if (url.pathname === "/push-token") {
      if (!env.SO_THU_CHI_KV) return json(500, { error: "KV chưa được cấu hình" }, h);
      let user;
      try {
        const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
        user = await verifyFirebaseToken(token, env.FIREBASE_PROJECT_ID, await getKeys());
      } catch { return json(401, { error: "Chưa đăng nhập hoặc phiên đăng nhập đã hết hạn" }, h); }
      const allowedEmails = (env.ALLOWED_EMAILS || "").toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
      if (!allowedEmails.includes(String(user.email || "").toLowerCase())) return json(403, { error: "Email chưa được phép" }, h);
      let body;
      try { body = await request.json(); } catch { return json(400, { error: "Dữ liệu không hợp lệ" }, h); }
      if (!body?.token || typeof body.token !== "string") return json(400, { error: "Thiếu FCM token" }, h);
      await env.SO_THU_CHI_KV.put("token:" + user.sub, body.token, { expirationTtl: 60 * 24 * 3600 });
      return json(200, { ok: true }, h);
    }

    // ---- POST / (default): DeepSeek AI proxy ----
    if (!env.DEEPSEEK_API_KEY) return json(500, { error: "Proxy chưa có DEEPSEEK_API_KEY" }, h);
    let user;
    try {
      const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      user = await verifyFirebaseToken(token, env.FIREBASE_PROJECT_ID, await getKeys());
    } catch { return json(401, { error: "Chưa đăng nhập hoặc phiên đăng nhập đã hết hạn" }, h); }
    const allowedEmails = (env.ALLOWED_EMAILS || "").toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
    const email = String(user.email || "").toLowerCase();
    if (!user.email_verified || !allowedEmails.includes(email)) return json(403, { error: "Email này chưa được phép dùng cố vấn AI" }, h);
    let body;
    try { body = await request.json(); } catch { return json(400, { error: "Dữ liệu gửi lên không hợp lệ" }, h); }
    const messages = Array.isArray(body?.messages) ? body.messages : null;
    if (!messages || !messages.length || messages.length > MAX_MESSAGES) return json(400, { error: "Danh sách tin nhắn không hợp lệ" }, h);
    let chars = 0;
    for (const m of messages) {
      if (!m || !["system", "user", "assistant"].includes(m.role) || typeof m.content !== "string") return json(400, { error: "Tin nhắn không hợp lệ" }, h);
      chars += m.content.length;
    }
    if (chars > MAX_CHARS) return json(413, { error: "Câu hỏi quá dài" }, h);
    const upstream = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + env.DEEPSEEK_API_KEY },
      body: JSON.stringify({
        model: env.DEEPSEEK_MODEL || "deepseek-chat",
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        stream: true, temperature: 0.6, max_tokens: 1200
      })
    });
    if (!upstream.ok) {
      const status = upstream.status === 402 ? 402 : upstream.status === 429 ? 429 : 502;
      const msg = status === 402 ? "Tài khoản DeepSeek hết tiền" : status === 429 ? "DeepSeek đang quá tải, thử lại sau" : "DeepSeek báo lỗi " + upstream.status;
      return json(status, { error: msg }, h);
    }
    return new Response(upstream.body, {
      status: 200,
      headers: { ...h, "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" }
    });
  },

  // ---- Cron Triggers: nhắc lương ngày 15 và 25 (12h trưa giờ Nhật) ----
  async scheduled(event, env, ctx) {
    if (!env.SO_THU_CHI_KV || !env.FCM_SA_JSON) return;

    // Ngày theo giờ Nhật (UTC+9)
    const jpDate = new Date(event.scheduledTime + 9 * 3600 * 1000);
    const day = jpDate.getUTCDate();

    let title, body;
    if (day === 15) {
      title = "💰 Lương PanChan hôm nay";
      body = "Đã nhận lương chưa? Mở app ghi vào sổ nhé! Trợ cấp con 1 man 5 cũng đã tự cộng.";
    } else if (day === 25) {
      title = "💴 Lương tháng này";
      body = "Lương cơ bản 31 man đã tự cộng vào sổ. Tháng này có tăng ca không? Mở app thêm vào!";
    } else return;

    // Parse service account
    let sa;
    try { sa = JSON.parse(env.FCM_SA_JSON); } catch { console.error("FCM_SA_JSON parse error"); return; }

    // Lấy OAuth2 token
    let oauthToken;
    try { oauthToken = await getOAuthToken(sa.client_email, sa.private_key); }
    catch (e) { console.error("OAuth error:", e); return; }

    // Đọc FCM tokens từ KV
    const list = await env.SO_THU_CHI_KV.list({ prefix: "token:" });
    const sends = [];
    for (const key of list.keys) {
      const fcmToken = await env.SO_THU_CHI_KV.get(key.name);
      if (fcmToken) sends.push(sendFcmV1(env.FIREBASE_PROJECT_ID, fcmToken, title, body, "/", oauthToken));
    }
    ctx.waitUntil(Promise.allSettled(sends));
  }
};
