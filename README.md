# Sổ Thu Chi

Sổ tài chính gia đình dùng chung cho hai vợ chồng người Việt sống ở Nhật: thu chi bằng yên (¥) và đồng (₫), tài khoản ngân hàng Nhật và Việt Nam, sổ tiết kiệm, bảng tính lãi, bảng lãi suất ngân hàng, sổ mừng cưới (ai mừng mình bao nhiêu, gợi ý số tiền mừng lại), tiền mặt để dành (không lãi, chuyển sang gửi ngân hàng khi muốn), sổ nợ (ai nợ mình, mình nợ ai, từng lần trả), cảnh báo tiêu quá đà và cố vấn AI (DeepSeek).

**Link app:** https://so-thu-chi-ec435.firebaseapp.com (Firebase Hosting; link GitHub Pages cũ https://duchieu11099-pixel.github.io/so-thu-chi/ tự chuyển sang đây)

**Cài đặt lần đầu:** xem [HUONG-DAN.md](HUONG-DAN.md).

## Cấu trúc dự án

| Đường dẫn | Nội dung |
|---|---|
| `docs/index.html` | App web (HTML, CSS và JavaScript trong một tệp), đăng lên Firebase Hosting |
| `docs/config.js` | Cấu hình Firebase và địa chỉ proxy AI (không chứa mật khẩu) |
| `docs/rates.json` | Bảng lãi suất ngân hàng tham khảo |
| `docs/manifest.webmanifest`, `docs/icon.svg` | Để cài app lên màn hình chính điện thoại |
| `firebase.json`, `.firebaserc` | Cấu hình Firebase Hosting (đăng `docs/`) và quy tắc Firestore (`private/firestore.rules`) |
| `worker/` | Proxy DeepSeek chạy trên Cloudflare Worker (giữ API key, kiểm tra đăng nhập) |
| `firestore.rules` | Quy tắc bảo mật Firestore: chỉ email trong danh sách được đọc/ghi |
| `so-thu-chi.html` | Bản cũ chạy trên Claude Artifact (https://claude.ai/artifact/FnMzNaNGG2Q3WiaQxbSYSR), giữ lại để tham khảo |
| `private/` | Tệp riêng tư (quy tắc có email thật, dữ liệu xuất), **không đưa lên git** |

## Cách app chạy

- **Đăng nhập** bằng Google qua Firebase Authentication.
- **Dữ liệu** nằm trong Firestore, đồng bộ trực tiếp (`onSnapshot`) và có lưu tạm khi mất mạng. Không cấu hình Firebase thì app tự chuyển sang chế độ thử, lưu trong `localStorage`.
- **Cố vấn AI**: trang gửi câu hỏi kèm Firebase ID token tới proxy. Proxy kiểm tra token và email rồi gọi DeepSeek (`deepseek-chat`, dạng stream) bằng API key đặt trong secret của Cloudflare.
- **Gợi ý tự động** (vượt ngân sách, tốc độ chi, tiền cần để dành cho mục tiêu, sổ sắp đáo hạn, bảng tính lãi) được tính ngay trong trang, không cần AI.

### Dữ liệu trong Firestore

| Đường dẫn | Nội dung |
|---|---|
| `hh/main` | Thiết lập: `cur`, `income`, `limit`, `rate` (₫ cho 1 ¥), `catLimits`, `defAcc` |
| `hh/main/accounts/{id}` | Tài khoản: `name`, `cur`, `balance` |
| `hh/main/tx/{id}` | Giao dịch: `kind` (out/in/save/transfer), `amount`, `cur`, `acc`, `to`, `amount2`, `cat`, `note`, `date`, `month`, `by`, `byName`, `at` |
| `hh/main/goals/{id}` | Món đồ muốn mua: `name`, `price`, `cur`, `saved`, `by` |
| `hh/main/deposits/{id}` | Sổ tiết kiệm: `bank`, `cur`, `amount`, `rate`, `term`, `start`, `mode`, `from`. Tiền mặt để dành (không lãi) có `kind: "cash"` và không có `rate`, `term`, `mode` |
| `hh/main/gifts/{id}` | Mừng cưới: `dir` (in = họ mừng mình, out = mình đi mừng), `name`, `group`, `event`, `date`, `amount`, `cur`, `note`, `acc`, `txId` |
| `hh/main/debts/{id}` | Sổ nợ: `dir` (lend = người khác nợ mình, borrow = mình nợ), `name`, `amount`, `cur`, `date`, `due`, `note`, `acc`, `pays` (các lần trả: `amount`, `date`, `note`) |
| `ref/rates` | Bảng lãi suất (tự nạp từ `docs/rates.json` khi tệp mới hơn) |

## Chạy thử trên máy

```bash
python3 -m http.server 8123 --directory docs
```

Rồi mở http://localhost:8123.
