importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: "AIzaSyCbvKajLPa2Y6MSIx3Fq3t582ellMS_O-8",
  authDomain: "revix-bc8c4.firebaseapp.com",
  projectId: "revix-bc8c4",
  storageBucket: "revix-bc8c4.firebasestorage.app",
  messagingSenderId: "954598339265",
  appId: "1:954598339265:web:5786d48723c41616f81a40"
})

const messaging = firebase.messaging()

// Handle background messages
messaging.onBackgroundMessage(payload => {
  const { title, body } = payload.notification
  self.registration.showNotification(title, {
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: 'revix-alert',
    data: payload.data,
    actions: [
      { action: 'open', title: 'Ver detalles' }
    ]
  })
})

// Handle notification click
self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(
    clients.openWindow('https://revix-sooty.vercel.app')
  )
})
