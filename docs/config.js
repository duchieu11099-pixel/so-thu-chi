// Cấu hình Sổ Thu Chi. Xem HUONG-DAN.md để biết lấy các giá trị này ở đâu.
// Các giá trị Firebase dưới đây KHÔNG phải mật khẩu: an toàn khi để công khai,
// vì quyền đọc/ghi được khóa bằng quy tắc bảo mật Firestore (firestore.rules).
// Tuyệt đối KHÔNG dán API key DeepSeek vào tệp này.
window.SO_THU_CHI_CONFIG = {
  firebase: {
    apiKey: "DIEN_API_KEY",
    authDomain: "DIEN_PROJECT_ID.firebaseapp.com",
    projectId: "DIEN_PROJECT_ID",
    storageBucket: "DIEN_PROJECT_ID.appspot.com",
    messagingSenderId: "DIEN_SENDER_ID",
    appId: "DIEN_APP_ID"
  },
  // Địa chỉ proxy DeepSeek (Cloudflare Worker), ví dụ "https://so-thu-chi-ai.ten-ban.workers.dev"
  // Để trống "" nếu chưa cài: app vẫn chạy, chỉ tắt phần cố vấn AI.
  aiProxyUrl: "https://so-thu-chi-ai.duchieu11099.workers.dev"
};
