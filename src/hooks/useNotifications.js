import { useEffect } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'

// Firebase Messaging VAPID key — generate in Firebase Console
// Console → Project Settings → Cloud Messaging → Web Push certificates → Generate key pair
const VAPID_KEY = 'BEacrPKWhktL9NkrWQPlbNiqUblQwDFKx00X19MB48COJ2oauHW6x9pfaYRV5YNpK_or6lyzyoOZuGX8jjYKwjA'

export function useNotifications(userId) {
  useEffect(() => {
    if (!userId) return
    registerForNotifications(userId)
  }, [userId])
}

async function registerForNotifications(userId) {
  try {
    // Request permission
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return

    // Dynamic import to avoid SSR issues
    const { getMessaging, getToken } = await import('firebase/messaging')
    const { initializeApp, getApps } = await import('firebase/app')

    // Get existing app
    const app = getApps()[0]
    if (!app) return

    const messaging = getMessaging(app)
    const token = await getToken(messaging, { vapidKey: VAPID_KEY })

    if (token) {
      // Save FCM token to user profile
      await updateDoc(doc(db, 'users', userId), { fcmToken: token })
      console.log('FCM token registered')
    }
  } catch (err) {
    console.log('Notifications not available:', err.message)
  }
}
