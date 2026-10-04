'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import type { Session, User, AuthError } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { LoginValues, SignUpValues } from '@/types/auth'

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------
interface AuthContextValue {
  user: User | null
  session: Session | null
  /** True while the initial session is being fetched from Supabase. */
  loading: boolean
  signUp: (values: SignUpValues) => Promise<{ error: AuthError | null }>
  signIn: (values: LoginValues) => Promise<{ error: AuthError | null }>
  signInWithProvider: (provider: 'google') => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
  resendVerification: (email: string) => Promise<{ error: AuthError | null }>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// ---------------------------------------------------------------------------
// Helper — sync the verified OAuth identity through our server route.
// Runs after a social SIGNED_IN event so we can persist the auth_providers
// row using service_role without leaking that key to the browser.
// ---------------------------------------------------------------------------
async function syncOAuthProvider(session: Session): Promise<void> {
  const provider = session.user.app_metadata?.provider
  if (!provider || provider === 'email') return

  try {
    await fetch('/api/auth/sync-provider', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ provider }),
    })
  } catch {
    // Non-fatal. The public.users row already exists (created by DB trigger).
    // Only the auth_providers record may be missing; retry on next sign-in.
    console.warn('[useAuth] Failed to sync OAuth provider record.')
  }
}

// ---------------------------------------------------------------------------
// AuthProvider
// Wrap the app root (or layout) with this so all children can call useAuth().
// ---------------------------------------------------------------------------
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient()

  const [user, setUser]       = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 1. Hydrate state from persisted session (cookie / localStorage).
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // 2. Keep state in sync with Supabase Auth events (tab focus, token
    //    refresh, sign-out from another tab, etc.).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)

      if (event === 'SIGNED_IN' && session) {
        setTimeout(() => { void syncOAuthProvider(session) }, 0)
      }
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Auth actions
  // -------------------------------------------------------------------------
  const signUp = useCallback(
    async ({ email, password, display_name }: SignUpValues) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // display_name is picked up by the handle_new_auth_user DB trigger
          // via raw_user_meta_data ->> 'full_name'.
          data: { full_name: display_name },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      return { error }
    },
    [supabase],
  )

  const signIn = useCallback(
    async ({ email, password }: LoginValues) => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      return { error }
    },
    [supabase],
  )

  const signInWithProvider = useCallback(
    async (provider: 'google') => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      return { error }
    },
    [supabase],
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [supabase])

  const resendVerification = useCallback(
    async (email: string) => {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      return { error }
    },
    [supabase],
  )

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signUp,
        signIn,
        signInWithProvider,
        signOut,
        resendVerification,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// useAuth hook
// ---------------------------------------------------------------------------
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth() must be called inside <AuthProvider>.')
  }
  return ctx
}
