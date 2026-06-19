/**
 * useAuthUser — tiny React hook over Firebase auth.
 * Anonymous sign-in fallback so users can try the app without making an account.
 */
import { useEffect, useState } from 'react'
import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth'
import { auth } from './firebase'

export interface AuthState {
  user: User | null
  loading: boolean
}

export function useAuthUser(opts: { signInAnonymous?: boolean } = {}): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, loading: true })

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u && opts.signInAnonymous) {
        signInAnonymously(auth).catch(() => setState({ user: null, loading: false }))
        return
      }
      setState({ user: u, loading: false })
    })
    return unsub
  }, [opts.signInAnonymous])

  return state
}
