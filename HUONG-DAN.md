# Hướng dẫn cài đặt Sổ Thu Chi (miễn phí, không phụ thuộc Claude)

App gồm 3 phần, đều dùng gói miễn phí:

| Phần | Dịch vụ | Việc của nó |
|---|---|---|
| Trang app | GitHub Pages | Cho link mở trên mọi máy: `https://duchieu11099-pixel.github.io/so-thu-chi/` |
| Dữ liệu + đăng nhập | Firebase (Firestore + Google Sign-In) | Lưu và đồng bộ ngay giữa hai vợ chồng, có lưu tạm khi mất mạng |
| Cố vấn AI | Cloudflare Worker + DeepSeek | Giữ API key DeepSeek bí mật, chỉ cho hai vợ chồng hỏi |

Chưa làm bước 1 thì app vẫn mở được ở **chế độ thử** (dữ liệu chỉ nằm trên trình duyệt đó). Chưa làm bước 3 thì app chạy đủ, chỉ tắt phần cố vấn AI.

---

## Bước 1. Tạo Firebase (khoảng 10 phút)

1. Vào https://console.firebase.google.com, đăng nhập Google, bấm **Create a project** (Tạo dự án), đặt tên ví dụ `so-thu-chi`. Có thể tắt Google Analytics.
2. **Bật đăng nhập Google**: menu trái **Build → Authentication → Get started → Sign-in method → Google → Enable**, chọn email hỗ trợ, **Save**.
3. **Cho phép trang GitHub đăng nhập**: vẫn trong Authentication → **Settings → Authorized domains → Add domain**, nhập `duchieu11099-pixel.github.io`.
4. **Tạo cơ sở dữ liệu**: **Build → Firestore Database → Create database**, chọn vị trí `asia-northeast1 (Tokyo)`, chọn **production mode**.
5. **Dán quy tắc bảo mật**: trong Firestore → tab **Rules**, xoá hết nội dung cũ, dán nội dung tệp `firestore.rules`.
   - Thay `email-cua-ban@gmail.com` và `email-cua-vo@gmail.com` bằng email Google thật của hai vợ chồng.
   - Bản đã điền sẵn email của bạn nằm ở `private/firestore.rules` (thư mục này không đưa lên GitHub). Chỉ cần sửa email của vợ.
   - Bấm **Publish**.
6. **Lấy cấu hình**: bấm bánh răng **Project settings → General → Your apps → biểu tượng `</>` (Web)**, đặt tên app, **Register app**. Firebase hiện đoạn `const firebaseConfig = { apiKey: ..., ... }`.
7. Gửi đoạn `firebaseConfig` đó cho Claude để điền vào `docs/config.js`, hoặc tự điền rồi commit và push. Các giá trị này **không phải mật khẩu**: ai thấy cũng không vào được dữ liệu vì đã có quy tắc bảo mật ở bước 5.

Gói miễn phí (Spark) của Firestore: 1 GB dữ liệu, 50.000 lượt đọc và 20.000 lượt ghi mỗi ngày. Một gia đình dùng không hết.

---

## Bước 2. Mở app

- Link: **https://so-thu-chi-ec435.firebaseapp.com** (link GitHub cũ tự chuyển sang đây; dùng chung tên miền với trang đăng nhập nên đăng nhập trên điện thoại mới chạy)
- Bấm **Đăng nhập bằng Google** bằng email có trong quy tắc bảo mật.
- Lần đầu: bấm **Bắt đầu với số liệu của tôi**, vào **Thiết lập** chọn tiền yên, nhập thu nhập và giới hạn chi tiêu, rồi thêm tài khoản ngân hàng.
- Trên điện thoại: mở link bằng Safari (iPhone) hoặc Chrome (Android), chọn **Thêm vào màn hình chính** để có biểu tượng như app.

### Thêm người dùng

Thêm email vào danh sách trong quy tắc Firestore (bước 1.5) rồi bấm Publish lại. Nếu muốn người đó dùng được cả cố vấn AI thì thêm email vào `ALLOWED_EMAILS` của proxy (bước 3.4).

---

## Bước 3. Cố vấn AI bằng DeepSeek (khoảng 10 phút)

API key DeepSeek **không bao giờ** được dán vào app, vào chat hay vào GitHub. Key nằm trong một proxy nhỏ chạy miễn phí trên Cloudflare (100.000 lượt gọi mỗi ngày).

1. Tạo tài khoản miễn phí tại https://dash.cloudflare.com/sign-up.
2. Mở Terminal, vào thư mục `worker` của dự án:
   ```bash
   cd "/Users/mac/Applications/APP quản lý chi tiêu/worker"
   ```
3. Sửa `wrangler.toml`: thay `DIEN_PROJECT_ID` bằng **Project ID** của Firebase (xem trong Project settings).
4. Đăng nhập Cloudflare và đặt hai giá trị bí mật (lệnh sẽ hỏi, bạn dán vào Terminal):
   ```bash
   npx wrangler login
   ```
   ```bash
   npx wrangler secret put DEEPSEEK_API_KEY
   ```
   ```bash
   npx wrangler secret put ALLOWED_EMAILS
   ```
   Với `ALLOWED_EMAILS`, nhập email hai vợ chồng cách nhau bằng dấu phẩy, ví dụ `chong@gmail.com,vo@gmail.com`.
5. Đưa proxy lên mạng:
   ```bash
   npx wrangler deploy
   ```
   Lệnh in ra địa chỉ dạng `https://so-thu-chi-ai.<tên>.workers.dev`.
6. Điền địa chỉ đó vào `aiProxyUrl` trong `docs/config.js` (hoặc gửi cho Claude điền), rồi commit và push.

Chi phí DeepSeek tính theo lượt hỏi và rất rẻ (mỗi câu hỏi tốn khoảng vài phần trăm yên). Theo dõi số dư tại https://platform.deepseek.com.

---

## Đưa bản mới lên

```bash
npx -y firebase-tools@13 deploy --only hosting,firestore:rules
```

Lệnh này đăng thư mục `docs/` và quy tắc trong `private/firestore.rules` (có email thật, không lên GitHub). Sau đó commit và push để lưu mã nguồn.

## Sao lưu

Trong app: **Thiết lập → Tải bản sao lưu (JSON)**. Nên làm mỗi tháng một lần và cất tệp vào Google Drive hoặc iCloud. Có thể mở tệp CSV bằng Excel hoặc Google Sheets.

Khôi phục: **Thiết lập → Khôi phục từ tệp JSON**, chọn tệp, bấm nút khôi phục hai lần để xác nhận. Thao tác này ghi đè toàn bộ số liệu hiện có.

## Cập nhật bảng lãi suất

Sửa tệp `docs/rates.json` (đổi ngày ở `updated` sang ngày mới hơn) rồi commit và push. App tự nạp bản mới khi mở. Có thể nhờ Claude: "cập nhật lãi suất ngân hàng".

## Xử lý sự cố

| Hiện tượng | Cách xử lý |
|---|---|
| “Tài khoản … chưa có quyền vào sổ này” | Email chưa có trong quy tắc Firestore, hoặc gõ sai. Sửa rồi Publish lại. |
| Bấm đăng nhập không có gì xảy ra hoặc báo `auth/unauthorized-domain` | Chưa thêm `duchieu11099-pixel.github.io` vào Authorized domains (bước 1.3). |
| Cố vấn AI báo “chưa được phép” | Email chưa có trong `ALLOWED_EMAILS` của proxy. |
| Cố vấn AI báo “hết tiền” | Nạp thêm tiền vào tài khoản DeepSeek. |
| Chấm xám, báo “Đang ngoại tuyến” | Mất mạng. Cứ nhập bình thường, có mạng lại sẽ tự đồng bộ. |
