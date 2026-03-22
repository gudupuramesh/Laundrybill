/**
 * Firebase Cloud Messaging Service Worker
 * Handles push notifications when app is in background (e.g. new online order)
 * 
 * Must be at /firebase-messaging-sw.js (root of public folder)
 */

importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyA3zV9FYdoihfDYSMLHcDYX0cRPD3aimYQ",
  authDomain: "laundryos.firebaseapp.com",
  projectId: "laundryos",
  storageBucket: "laundryos.firebasestorage.app",
  messagingSenderId: "285945951840",
  appId: "1:285945951840:web:3150123aa6d1d60171f505",
  measurementId: "G-Z8V5PK34L3",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  console.log("[firebase-messaging-sw.js] Received background message", payload);

  const notification = payload.notification || {};
  const data = payload.data || {};
  const title = notification.title || "New Online Order";
  const body = notification.body || "";
  const icon = "/icons/icon-192x192.png";

  const options = {
    body,
    icon,
    badge: "/icons/icon-72x72.png",
    tag: data.orderId ? `order-${data.orderId}` : "fcm-notification",
    data: {
      url: data.orderId && data.shopId
        ? `/orders/${data.orderId}`
        : "/orders",
      orderId: data.orderId,
      shopId: data.shopId,
    },
  };

  return self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const url = event.notification.data?.url || "/orders";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(self.location.origin + url);
      }
    })
  );
});
