import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: "AIzaSyCbvKajLPa2Y6MSIx3Fq3t582ellMS_O-8",
  authDomain: "revix-bc8c4.firebaseapp.com",
  projectId: "revix-bc8c4",
  storageBucket: "revix-bc8c4.firebasestorage.app",
  messagingSenderId: "954598339265",
  appId: "1:954598339265:web:5786d48723c41616f81a40"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
