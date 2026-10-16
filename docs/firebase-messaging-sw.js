// Service Worker cho Firebase Cloud Messaging (push notification lương/chi tiêu)
// File này phải ở root (/) để có quyền nhận push cho toàn bộ app.

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAGELhaeUxFfBTcpvEUdbO8_SgyZGTWELE",
  authDomain: "so-thu-chi-ec435.firebaseapp.com",
  projectId: "so-thu-chi-ec435",
  storageBucket: "so-thu-chi-ec435.firebasestorage.app",
  messagingSenderId: "843441554185",
  appId: "1:843441554185:web:3cd6f1a77e34ab8d06c9d8"
});

const messaging = firebase.messaging();

// Xử lý thông báo khi app đang đóng (background)
messaging.onBackgroundMessage((payload) => {
  const n = payload.notification || {};
  self.registration.showNotification(n.title || 'Sổ Thu Chi', {
    body: n.body || '',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: payload.data?.tag || 'stc',
    renotify: true,
    data: { url: payload.data?.url || '/' }
  });
});

// Nhấn vào thông báo → mở app
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
      for (const w of wins) { if (w.url.includes(self.location.origin)) { w.focus(); return; } }
      return clients.openWindow(url);
    })
  );
});
