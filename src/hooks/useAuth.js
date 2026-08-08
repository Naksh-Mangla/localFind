import { useCallback, useEffect, useState } from 'react'
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut
} from 'firebase/auth'
import { firebaseApp } from '../lib/firebase'

const auth = getAuth(firebaseApp)

export function useAuth() {
  const [user, setUser] = useState(null)
  const [idToken, setIdToken] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      setIdToken(firebaseUser ? await firebaseUser.getIdToken() : null)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider()
    const result = await signInWithPopup(auth, provider)
    setIdToken(await result.user.getIdToken())
  }, [])

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth)
    setUser(null)
    setIdToken(null)
  }, [])

  return { user, idToken, loading, signInWithGoogle, signOut }
}
