import { z } from 'zod'
import { checkoutUrl, UUID } from './guards'

export class CheckoutRecoveryError extends Error {
  constructor(public readonly code: string) { super(code) }
}

const recordSchema = z.object({
  id: z.string().regex(UUID), user_id: z.string().regex(UUID), price_id: z.string().regex(UUID),
  request_id: z.string().regex(UUID), stripe_price_id: z.string().regex(/^price_[A-Za-z0-9]+$/),
  amount_cents: z.number().int().min(1).max(1000000), currency: z.literal('brl'),
  creation_state: z.enum(['RESERVED', 'CREATING', 'UNCERTAIN', 'BOUND']),
  payment_state: z.enum(['pending', 'paid', 'expired', 'failed']),
  stripe_session_id: z.string().regex(/^cs_test_[A-Za-z0-9]+$/).nullable(),
  checkout_url: z.string().nullable(), expires_at: z.number().int().positive().safe().nullable(),
  created_at: z.string().datetime({ offset: true }), updated_at: z.string().datetime({ offset: true }),
})
const sessionSchema = z.object({
  id: z.string().regex(/^cs_test_[A-Za-z0-9]+$/), livemode: z.literal(false),
  mode: z.literal('payment'), ui_mode: z.literal('hosted_page'),
  client_reference_id: z.string().regex(UUID),
  metadata: z.object({ millennium_checkout_id: z.string().regex(UUID) }),
  amount_subtotal: z.number().int().positive().safe(), amount_total: z.number().int().positive().safe(),
  currency: z.literal('brl'), payment_status: z.enum(['unpaid', 'paid']),
  status: z.enum(['open', 'complete', 'expired']), created: z.number().int().positive().safe(),
  expires_at: z.number().int().positive().safe(), url: z.string().nullable(),
  line_items: z.object({ has_more: z.literal(false), data: z.array(z.object({
    quantity: z.literal(1), currency: z.literal('brl'), amount_total: z.number().int().positive().safe(),
    amount_subtotal: z.number().int().positive().safe(),
    price: z.object({ id: z.string(), currency: z.literal('brl'), livemode: z.literal(false),
      type: z.literal('one_time'), recurring: z.null(), unit_amount: z.number().int().positive().safe(),
    }),
  })).length(1) }),
})
export type RecoveryRecord = z.infer<typeof recordSchema>
export type RecoverySession = z.infer<typeof sessionSchema>
export interface RecoveryRequest { checkoutId: string; sessionId: string; bindOpen: boolean }
export interface RecoveryStore {
  load(id: string): Promise<unknown>
  bindOpen(record: RecoveryRecord, session: RecoverySession): Promise<boolean>
}
export interface RecoveryProvider { retrieve(id: string): Promise<unknown> }
export interface RecoveryResult {
  checkoutId: string; sessionId: string; applied: boolean
  outcome: 'READY_TO_BIND' | 'OPEN_SESSION_BOUND' | 'ALREADY_BOUND' | 'TERMINAL_SESSION_REQUIRES_REVIEW'
}

export async function recoverCheckout(store: RecoveryStore, provider: RecoveryProvider,
  request: RecoveryRequest, now = Date.now()): Promise<RecoveryResult> {
  if (!UUID.test(request.checkoutId) || !/^cs_test_[A-Za-z0-9]{1,200}$/.test(request.sessionId) ||
      typeof request.bindOpen !== 'boolean' || !Number.isSafeInteger(now) || now <= 0) {
    throw new CheckoutRecoveryError('INVALID_REQUEST')
  }
  let raw: unknown
  try { raw = await store.load(request.checkoutId) }
  catch { throw new CheckoutRecoveryError('DATABASE_READ_FAILED') }
  if (!raw) throw new CheckoutRecoveryError('CHECKOUT_NOT_FOUND')
  const parsed = recordSchema.safeParse(raw)
  if (!parsed.success) throw new CheckoutRecoveryError('UNSAFE_RECORD')
  const record = parsed.data
  const created = Date.parse(record.created_at), updated = Date.parse(record.updated_at)
  if (record.id !== request.checkoutId || updated < created || updated > now ||
      record.creation_state === 'RESERVED') throw new CheckoutRecoveryError('UNSAFE_RECORD')
  if (record.creation_state === 'BOUND') {
    if (record.stripe_session_id !== request.sessionId || !record.checkout_url || !checkoutUrl(record.checkout_url) ||
        !record.expires_at) throw new CheckoutRecoveryError('BINDING_MISMATCH')
  } else {
    if (record.payment_state !== 'pending' || record.stripe_session_id !== null ||
        record.checkout_url !== null || record.expires_at !== null) throw new CheckoutRecoveryError('UNSAFE_RECORD')
    // Do not compete with the original ten-second provider call or a recent operator attempt.
    if (now - updated < 120000) throw new CheckoutRecoveryError('ATTEMPT_TOO_RECENT')
  }
  try { raw = await provider.retrieve(request.sessionId) }
  catch { throw new CheckoutRecoveryError('STRIPE_READ_FAILED') }
  const remote = sessionSchema.safeParse(raw)
  if (!remote.success) throw new CheckoutRecoveryError('SESSION_MISMATCH')
  const session = remote.data, item = session.line_items.data[0]
  if (session.id !== request.sessionId || session.metadata.millennium_checkout_id !== record.id ||
      session.client_reference_id !== record.user_id || session.amount_total !== record.amount_cents ||
      session.amount_subtotal !== record.amount_cents || item.amount_total !== record.amount_cents ||
      item.amount_subtotal !== record.amount_cents || item.price.id !== record.stripe_price_id ||
      item.price.unit_amount !== record.amount_cents || session.created * 1000 < created - 300000 ||
      session.created * 1000 > now + 30000 || session.expires_at <= session.created ||
      (session.status === 'open' || session.status === 'expired') && session.payment_status !== 'unpaid') {
    throw new CheckoutRecoveryError('SESSION_MISMATCH')
  }
  const result = { checkoutId: record.id, sessionId: session.id, applied: false }
  if (record.creation_state === 'BOUND') return { ...result, outcome: 'ALREADY_BOUND' }
  if (session.status !== 'open' || session.expires_at * 1000 <= now) {
    return { ...result, outcome: 'TERMINAL_SESSION_REQUIRES_REVIEW' }
  }
  if (!session.url || !checkoutUrl(session.url)) throw new CheckoutRecoveryError('SESSION_MISMATCH')
  if (!request.bindOpen) return { ...result, outcome: 'READY_TO_BIND' }
  let bound: boolean
  try { bound = await store.bindOpen(record, session) }
  catch { throw new CheckoutRecoveryError('BIND_OUTCOME_UNCONFIRMED_READ_AGAIN') }
  if (!bound) throw new CheckoutRecoveryError('CONCURRENT_CHANGE_READ_AGAIN')
  return { ...result, outcome: 'OPEN_SESSION_BOUND', applied: true }
}
