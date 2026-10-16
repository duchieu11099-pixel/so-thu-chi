// Cấu hình Sổ Thu Chi. Xem HUONG-DAN.md để biết lấy các giá trị này ở đâu.
// Các giá trị Firebase dưới đây KHÔNG phải mật khẩu: an toàn khi để công khai,
// vì quyền đọc/ghi được khóa bằng quy tắc bảo mật Firestore (firestore.rules).
// Tuyệt đối KHÔNG dán API key DeepSeek vào tệp này.
window.SO_THU_CHI_CONFIG = {
  firebase: {
    apiKey: "AIzaSyAGELhaeUxFfBTcpvEUdbO8_SgyZGTWELE",
    authDomain: "so-thu-chi-ec435.firebaseapp.com",
    projectId: "so-thu-chi-ec435",
    storageBucket: "so-thu-chi-ec435.firebasestorage.app",
    messagingSenderId: "843441554185",
    appId: "1:843441554185:web:3cd6f1a77e34ab8d06c9d8"
  },
  // Địa chỉ proxy DeepSeek (Cloudflare Worker).
  // Để trống "" nếu chưa cài: app vẫn chạy, chỉ tắt phần cố vấn AI.
  aiProxyUrl: "https://so-thu-chi-ai.duchieu11099.workers.dev"
};
