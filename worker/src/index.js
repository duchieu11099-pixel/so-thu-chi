// Proxy DeepSeek cho Sổ Thu Chi (Cloudflare Worker).
// - Giữ API key DeepSeek ở phía máy chủ (secret DEEPSEEK_API_KEY), trang web không bao giờ thấy key.
// - Chỉ trả lời người đã đăng nhập Firebase bằng email nằm trong ALLOWED_EMAILS.
// - Chuyển tiếp câu trả lời dạng stream (SSE) về trang.

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

// Kiểm tra Firebase ID token (JWT RS256) theo tài liệu của Firebase.
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
  async fetch(request, env) {
    const h = cors(env, request.headers.get("Origin"));
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
    if (request.method !== "POST") return json(405, { error: "Chỉ hỗ trợ POST" }, h);
    if (!env.DEEPSEEK_API_KEY) return json(500, { error: "Proxy chưa có DEEPSEEK_API_KEY" }, h);

    // 1. Xác thực người dùng
    let user;
    try {
      const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      user = await verifyFirebaseToken(token, env.FIREBASE_PROJECT_ID, await getKeys());
    } catch (e) {
      return json(401, { error: "Chưa đăng nhập hoặc phiên đăng nhập đã hết hạn" }, h);
    }
    const allowedEmails = (env.ALLOWED_EMAILS || "").toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
    const email = String(user.email || "").toLowerCase();
    if (!user.email_verified || !allowedEmails.includes(email)) return json(403, { error: "Email này chưa được phép dùng cố vấn AI" }, h);

    // 2. Kiểm tra nội dung gửi lên
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

    // 3. Gọi DeepSeek và chuyển tiếp stream
    const upstream = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + env.DEEPSEEK_API_KEY },
      body: JSON.stringify({
        model: env.DEEPSEEK_MODEL || "deepseek-chat",
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        stream: true,
        temperature: 0.6,
        max_tokens: 1200
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
  }
};
