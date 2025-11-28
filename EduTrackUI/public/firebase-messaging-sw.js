/**
 * Firebase Messaging Service Worker
 * 
 * Handles Firebase Cloud Messaging (FCM) notifications in the background
 * (when the app is not in focus).
 * 
 * This file should be placed in the public/ directory as `firebase-messaging-sw.js`
 * so it can be registered and handle background messages.
 */

// Import Firebase scripts (these are loaded from CDN in the main app)
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
// These credentials should match your main app Firebase config
const firebaseConfig = {
  apiKey: 'AIzaSyCzitWnYSshOh_BJbacV-iPnXL-dn8FRv4',
  authDomain: 'edutrack-478b4.firebaseapp.com',
  projectId: 'edutrack-478b4',
  storageBucket: 'edutrack-478b4.firebasestorage.app',
  messagingSenderId: '333734015612',
  appId: '1:333734015612:web:98cc3eaaf824af9703cff9',
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Handle background messages
// This is called when the app is NOT in focus
messaging.onBackgroundMessage((payload) => {
  console.log('Background message received:', payload);

  const { title, body, image, icon, ...options } = payload.notification || {};
  const data = payload.data || {};

  // Show notification
  const notificationOptions = {
    body: body || '',
    icon: icon || '/logo.png',
    image: image || undefined,
    badge: '/badge.png',
    tag: data.type || 'notification', // Groups similar notifications
    data: data, // Custom data passed to notification click handler
    ...options,
  };

  self.registration.showNotification(title || 'Notification', notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const action = data.action || 'open';

  let urlToOpen = '/';

  // Route based on notification type and action
  if (data.type === 'direct_message' && data.sender_id) {
    urlToOpen = `/student/messages?conversation=${data.sender_id}`;
  } else if (data.type === 'broadcast' && data.broadcast_id) {
    urlToOpen = `/student/messages?broadcast=${data.broadcast_id}`;
  }

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    }).then((windowClients) => {
      // Check if the app is already open
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If not open, open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
