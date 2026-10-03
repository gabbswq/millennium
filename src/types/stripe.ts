export type StripeConnectionRow = {
  user_id: string
  request_id: string
  stripe_account_id: string | null
  creation_state: 'RESERVED' | 'CREATING' | 'UNCERTAIN' | 'BOUND'
  livemode: boolean
  last_event_created: number
  created_at: string
  updated_at: string
}

export type CheckoutRow = {
  id: string; user_id: string; price_id: string; request_id: string
  stripe_price_id: string; amount_cents: number; currency: string
  creation_state: 'RESERVED' | 'CREATING' | 'UNCERTAIN' | 'BOUND'
  stripe_session_id: string | null; checkout_url: string | null; expires_at: number | null
  payment_state: 'pending' | 'paid' | 'expired' | 'failed'
  created_at: string; updated_at: string
}
