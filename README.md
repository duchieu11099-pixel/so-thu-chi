# Sổ Thu Chi

Sổ tài chính gia đình dùng chung (hai vợ chồng), cho người Việt sống ở Nhật: thu chi bằng yên (¥) và đồng (₫), tài khoản ngân hàng Nhật và Việt Nam, sổ tiết kiệm, bảng tính lãi, bảng lãi suất ngân hàng và cố vấn AI (Claude).

**Link dùng app:** https://claude.ai/artifact/FnMzNaNGG2Q3WiaQxbSYSR

## Tệp

- `so-thu-chi.html`: toàn bộ app (HTML, CSS và JavaScript trong một tệp). Đây là bản được xuất bản lên link trên.

## Cách app chạy

App là một Claude Artifact. Khi mở trên claude.ai, trang được cấp ba quyền:

- `db`: cơ sở dữ liệu dùng chung, đồng bộ trực tiếp giữa mọi người được mời.
- `user`: biết ai đang xem, để ghi "nhập bởi" cho từng giao dịch.
- `sample`: hỏi Claude, dùng cho cố vấn AI và gợi ý nơi gửi tiết kiệm.

Trang không gọi được API bên ngoài (không DeepSeek, OpenAI, API ngân hàng hay tỷ giá) vì artifact chặn mọi kết nối ra ngoài. Tỷ giá ¥/₫ do người dùng tự nhập.

Mở tệp HTML trực tiếp trên máy (không qua claude.ai) thì app vẫn chạy, nhưng dữ liệu chỉ lưu trong trình duyệt đó và không có AI hay bảng lãi suất.

### Cấu trúc dữ liệu (db)

| Đường dẫn | Nội dung |
|---|---|
| `hh/main` | Thiết lập: `cur`, `income`, `limit`, `rate` (₫ cho 1 ¥), `catLimits`, `defAcc` |
| `hh/main/accounts/<id>` | Tài khoản: `name`, `cur`, `balance` |
| `hh/main/tx/<id>` | Giao dịch: `kind` (out/in/save/transfer), `amount`, `cur`, `acc`, `to`, `amount2`, `cat`, `note`, `date`, `month`, `by`, `at` |
| `hh/main/goals/<id>` | Món đồ muốn mua: `name`, `price`, `cur`, `saved`, `by` |
| `hh/main/deposits/<id>` | Sổ tiết kiệm: `bank`, `cur`, `amount`, `rate`, `term`, `start`, `mode`, `from` |
| `ref/rates` | Bảng lãi suất tham khảo (chỉ chủ sổ ghi được, Claude cập nhật) |

Quyền: chỉ người được mời với quyền Contributor/Editor mới đọc và ghi được; người xem qua link không thấy số liệu.

## Sửa và cập nhật

1. Mở dự án này trong Claude Code, nhờ thêm tính năng (sửa `so-thu-chi.html`).
2. Claude xuất bản lại lên cùng link ở trên; dữ liệu trong db được giữ nguyên.
3. Commit thay đổi vào git.

Muốn cập nhật bảng lãi suất: nhắn Claude "cập nhật lãi suất ngân hàng", Claude sẽ tra và ghi lại `ref/rates`.
