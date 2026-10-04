import type { User } from '@supabase/supabase-js'

// Call server-side only with a user returned by auth.getUser(token).
export function providerRecord(user: Pick<User, 'id' | 'identities' | 'is_anonymous' | 'email_confirmed_at'>, provider: string) {
  if (user.is_anonymous || !user.email_confirmed_at || ['email', 'phone'].includes(provider)) return null
  const matches = user.identities?.filter(identity => identity.provider === provider && identity.user_id === user.id) ?? []
  if (matches.length !== 1) return null
  const identity = matches[0]
  // GoTrue's API serializes provider_id as id; identity_id is the internal UUID.
  if (!identity.id || identity.id.length > 255 || identity.id.trim() !== identity.id) return null
  return { user_id: user.id, provider, provider_user_id: identity.id, provider_data: {} }
}
