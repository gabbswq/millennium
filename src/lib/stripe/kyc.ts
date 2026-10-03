export type KycState = 'pending' | 'review' | 'blocked' | 'ready'

export interface AccountFacts {
  id: string
  deleted?: boolean | void
  details_submitted?: boolean
  charges_enabled?: boolean
  payouts_enabled?: boolean
  capabilities?: { card_payments?: string; transfers?: string }
  requirements?: {
    currently_due?: string[] | null
    past_due?: string[] | null
    pending_verification?: string[] | null
    disabled_reason?: string | null
  } | null
}

export interface KycResult {
  state: KycState
  pendingCount: number
  reviewingCount: number
}

export function evaluateKyc(account: AccountFacts, expectedId: string): KycResult {
  const blocked: KycResult = { state: 'blocked', pendingCount: 0, reviewingCount: 0 }
  if (!/^acct_[A-Za-z0-9]+$/.test(expectedId) || account.id !== expectedId || account.deleted) return blocked
  const requirements = account.requirements
  if (!requirements || !Array.isArray(requirements.currently_due) ||
      !Array.isArray(requirements.past_due) || !Array.isArray(requirements.pending_verification)) return blocked
  const pendingCount = new Set([...requirements.currently_due, ...requirements.past_due]).size
  const reviewingCount = requirements.pending_verification.length
  const result = (state: KycState): KycResult => ({ state, pendingCount, reviewingCount })
  const reason = requirements.disabled_reason
  if (reason && !reason.startsWith('requirements.')) return result('blocked')
  if (pendingCount || account.details_submitted !== true) return result('pending')
  if (reviewingCount || reason === 'requirements.pending_verification') return result('review')
  if (reason || account.charges_enabled !== true || account.payouts_enabled !== true ||
      account.capabilities?.card_payments !== 'active' || account.capabilities?.transfers !== 'active') return result('blocked')
  return result('ready')
}

export function verifiedIdentity(user: {
  id?: string; email_confirmed_at?: string | null; is_anonymous?: boolean
} | null): boolean {
  return Boolean(user && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(user.id ?? '') &&
    user.email_confirmed_at && user.is_anonymous !== true)
}

export function trustedStripeUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'connect.stripe.com' && !url.username && !url.password && !url.port
  } catch { return false }
}
