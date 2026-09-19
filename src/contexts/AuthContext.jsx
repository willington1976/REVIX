import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import Splash from '../pages/Splash'
const AuthContext = createContext()
export const useAuth = () => useContext(AuthContext)
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fu) => {
      if (fu) { const s = await getDoc(doc(db,'users',fu.uid)); setUser(fu); setProfile(s.exists()?s.data():{}) }
      else { setUser(null); setProfile(null) }
      setLoading(false)
    })
    return unsub
  }, [])
  const login = (e,p) => signInWithEmailAndPassword(auth,e,p)
  const logout = () => signOut(auth)
  return <AuthContext.Provider value={{user,profile,loading,login,logout}}>{!loading&&children}</AuthContext.Provider>
}
