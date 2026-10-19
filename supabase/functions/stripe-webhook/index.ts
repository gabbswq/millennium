// =============================================================================
// Stripe Webhook Edge Function
//
// Entry point for all Stripe events. Validates the webhook signature, routes
// to the appropriate handler, and returns 2xx/5xx so Stripe knows whether to
// retry.
//
// Environment variables required (set via `supabase secrets set`):
//   STRIPE_SECRET_KEY       — sk_live_… or sk_test_…
//   STRIPE_WEBHOOK_SECRET   — whsec_… (from Stripe Dashboard → Webhooks)
//   SUPABASE_URL            — injected automatically by Supabase
//   SUPABASE_SERVICE_ROLE_KEY — injected automatically by Supabase
//
// Events handled:
//   checkout.session.completed
//   payment_intent.succeeded
//   invoice.payment_succeeded
//   customer.subscription.created
//   customer.subscription.updated
//   customer.subscription.deleted
//
// Idempotency:
//   payments.stripe_event_id UNIQUE prevents double-processing payment events.
//   subscriptions.stripe_subscription_id ON CONFLICT DO UPDATE is safe to
//   call multiple times.
//
// Realtime:
//   Clients subscribe to `orders` and `subscriptions` table changes via
//   Supabase Realtime. No additional broadcast step is needed here — the DB
//   row update triggers the client automatically.
//
// Discord provisioning:
//   If a product has metadata.discord_role_id set, a separate
//   `provision-discord` Edge Function is called after checkout completion.
// =============================================================================

import Stripe from 'npm:stripe@17'
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

// ---------------------------------------------------------------------------
// Initialise Stripe with the Fetch HTTP client (required in Deno / Edge).
// ---------------------------------------------------------------------------
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  // Pin the API version so a Stripe dashboard upgrade never silently breaks
  // the event shape this function expects.
  apiVersion: '2025-02-24.acacia',
  httpClient: Stripe.createFetchHttpClient(),
})

// ---------------------------------------------------------------------------
// Admin Supabase client — bypasses RLS for all DB mutations.
// Never expose SUPABASE_SERVICE_ROLE_KEY to the browser.
// ---------------------------------------------------------------------------
function makeAdminClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )
}

// ---------------------------------------------------------------------------
// Main request handler
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const sig = req.headers.get('stripe-signature')
  if (!sig) {
    return new Response('Missing stripe-signature header', { status: 400 })
  }

  // Read raw body BEFORE any parsing.
  // Stripe's signature covers the exact bytes it sent; JSON.parse then
  // re-stringify would invalidate it.
  const rawBody = await req.text()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      sig,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[stripe-webhook] Signature verification failed: ${msg}`)
    // 400 tells Stripe not to retry — the request was malformed or tampered.
    return new Response(`Webhook error: ${msg}`, { status: 400 })
  }

  console.log(`[stripe-webhook] ${event.type} (${event.id})`)

  const db = makeAdminClient()

  try {
    await dispatch(event, db)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[stripe-webhook] Handler failed for ${event.id}: ${msg}`)
    // 500 tells Stripe to retry. Idempotency guards prevent duplicate effects
    // on subsequent attempts.
    return new Response('Handler error — will retry', { status: 500 })
  }

  return new Response(
    JSON.stringify({ received: true, event_id: event.id }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})

// ---------------------------------------------------------------------------
// Event router
// ---------------------------------------------------------------------------
async function dispatch(event: Stripe.Event, db: SupabaseClient): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
      await onCheckoutSessionCompleted(event, db)
      break

    case 'payment_intent.succeeded':
      await onPaymentIntentSucceeded(event, db)
      break

    case 'invoice.payment_succeeded':
      await onInvoicePaymentSucceeded(event, db)
      break

    case 'customer.subscription.created':
      await onSubscriptionUpdated(event, db)
      break

    case 'customer.subscription.updated':
      await onSubscriptionUpdated(event, db)
      break

    case 'customer.subscription.deleted':
      await onSubscriptionDeleted(event, db)
      break

    default:
      // Log but do not error — unhandled events are common (e.g. charge.updated).
      console.log(`[stripe-webhook] Skipping unhandled event: ${event.type}`)
  }
}

// ===========================================================================
// Event handlers
// ===========================================================================

// ---------------------------------------------------------------------------
// checkout.session.completed
//   Fires after the customer successfully completes the Stripe Checkout page.
//   For one-time purchases this is the primary "paid" signal.
//   For subscriptions, customer.subscription.* events carry the subscription
//   state and are handled separately.
// ---------------------------------------------------------------------------
async function onCheckoutSessionCompleted(
  event: Stripe.Event,
  db: SupabaseClient,
): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session

  // client_reference_id must be set to the Supabase user UUID when creating
  // the Checkout Session in the checkout Edge Function.
  const userId       = session.client_reference_id ?? null
  const customerId   = stripeId(session.customer)
  const intentId     = stripeId(session.payment_intent)

  // 1. Ensure stripe_customers mapping exists so future events can resolve
  //    the local user from the Stripe customer ID.
  if (userId && customerId) {
    const { error } = await db
      .from('stripe_customers')
      .upsert(
        { user_id: userId, stripe_customer_id: customerId },
        { onConflict: 'user_id', ignoreDuplicates: true },
      )
    if (error) {
      console.warn(`[stripe-webhook] stripe_customers upsert: ${error.message}`)
    }
  }

  // 2. Mark the local order completed — primary lookup by stripe_session_id.
  let order: { id: string; product_id: string; user_id: string | null } | null = null

  const { data: primaryOrder, error: primaryErr } = await db
    .from('orders')
    .update({
      status: 'completed',
      ...(intentId && { stripe_payment_intent_id: intentId }),
      updated_at: now(),
    })
    .eq('stripe_session_id', session.id)
    .select('id, product_id, user_id')
    .maybeSingle()

  if (primaryErr) {
    console.warn(
      `[stripe-webhook] Order update for session ${session.id}: ${primaryErr.message}`,
    )
  } else if (primaryOrder) {
    order = primaryOrder
    console.log(`[stripe-webhook] Order ${order.id} → completed`)
  } else {
    // Fallback: stripe_session_id may be missing if the patch step in
    // create-checkout failed non-fatally. Locate the order by metadata.order_id,
    // which was set server-side in create-checkout and arrives via the validated
    // Stripe event — not from client-supplied data.
    const fallbackOrderId = session.metadata?.order_id ?? null
    if (fallbackOrderId) {
      const { data: fallbackOrder, error: fallbackErr } = await db
        .from('orders')
        .update({
          status: 'completed',
          stripe_session_id: session.id,
          ...(intentId && { stripe_payment_intent_id: intentId }),
          updated_at: now(),
        })
        .eq('id', fallbackOrderId)
        .eq('status', 'pending')   // idempotency: skip if already completed
        .select('id, product_id, user_id')
        .maybeSingle()

      if (fallbackErr) {
        console.warn(
          `[stripe-webhook] Fallback order update for ${fallbackOrderId}: ${fallbackErr.message}`,
        )
      } else if (fallbackOrder) {
        order = fallbackOrder
        console.log(`[stripe-webhook] Order ${order.id} → completed (via metadata fallback)`)
      } else {
        console.warn(
          `[stripe-webhook] No pending order found for session ${session.id} or metadata.order_id ${fallbackOrderId}`,
        )
      }
    } else {
      // Non-fatal — order may not exist if checkout was initiated outside this
      // system (e.g., a Stripe Payment Link).
      console.warn(
        `[stripe-webhook] No order found for session ${session.id} — possibly external checkout`,
      )
    }
  }

  // 3. Trigger Discord role provisioning if the product maps to a role.
  const resolvedUserId = order?.user_id ?? userId
  if (order?.product_id && resolvedUserId) {
    await triggerDiscordProvisioning(order.product_id, resolvedUserId, db)
  }
}

// ---------------------------------------------------------------------------
// payment_intent.succeeded
//   Creates the canonical payment record in our DB.
//   Uses stripe_event_id as the idempotency key — safe to receive twice.
// ---------------------------------------------------------------------------
async function onPaymentIntentSucceeded(
  event: Stripe.Event,
  db: SupabaseClient,
): Promise<void> {
  const pi = event.data.object as Stripe.PaymentIntent

  const customerId = stripeId(pi.customer)
  const userId = pi.metadata?.supabase_user_id
    ?? await resolveUser(customerId, db)

  const { error } = await db.from('payments').insert({
    user_id:                   userId,
    stripe_payment_intent_id:  pi.id,
    stripe_event_id:           event.id,
    amount_cents:              pi.amount_received,
    currency:                  pi.currency,
    status:                    'succeeded',
    raw_event:                 event as unknown as Record<string, unknown>,
  })

  if (isUniqueViolation(error)) {
    console.log(`[stripe-webhook] ${event.id} already processed — skipping`)
    return
  }
  if (error) throw error

  console.log(`[stripe-webhook] Payment record created — intent ${pi.id}`)
}

// ---------------------------------------------------------------------------
// invoice.payment_succeeded
//   Fires on every successful subscription charge (initial + renewals).
//   Updates the subscription period_end and records the payment.
// ---------------------------------------------------------------------------
async function onInvoicePaymentSucceeded(
  event: Stripe.Event,
  db: SupabaseClient,
): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice

  const subscriptionId = stripeId(invoice.subscription)
  if (!subscriptionId) {
    // Not a subscription invoice (e.g. a one-off invoice) — skip.
    return
  }

  // Fetch live subscription data from Stripe to get authoritative period dates.
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  await upsertSubscription(subscription, db)

  // Record the payment.
  const customerId = stripeId(invoice.customer)
  const userId     = await resolveUser(customerId, db)
  const intentId   = stripeId(invoice.payment_intent)

  const { error } = await db.from('payments').insert({
    user_id:                  userId,
    stripe_payment_intent_id: intentId,
    stripe_event_id:          event.id,
    amount_cents:             invoice.amount_paid,
    currency:                 invoice.currency,
    status:                   'succeeded',
    raw_event:                event as unknown as Record<string, unknown>,
  })

  if (isUniqueViolation(error)) {
    console.log(`[stripe-webhook] ${event.id} already processed — skipping`)
    return
  }
  if (error) throw error

  console.log(`[stripe-webhook] Invoice payment recorded for subscription ${subscriptionId}`)
}

// ---------------------------------------------------------------------------
// customer.subscription.updated
//   Covers: plan change, cancel_at_period_end toggle, status transitions
//   (trialing → active, active → past_due, etc.).
// ---------------------------------------------------------------------------
async function onSubscriptionUpdated(
  event: Stripe.Event,
  db: SupabaseClient,
): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription
  await upsertSubscription(subscription, db)
  console.log(`[stripe-webhook] Subscription ${subscription.id} → ${subscription.status}`)
}

// ---------------------------------------------------------------------------
// customer.subscription.deleted
//   Stripe fires this when a subscription is fully cancelled (not just set to
//   cancel at period end — that fires subscription.updated).
// ---------------------------------------------------------------------------
async function onSubscriptionDeleted(
  event: Stripe.Event,
  db: SupabaseClient,
): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription
  // upsertSubscription handles status = 'canceled' via the ON CONFLICT path.
  await upsertSubscription(subscription, db)
  console.log(`[stripe-webhook] Subscription ${subscription.id} cancelled`)
}

// ===========================================================================
// Shared helpers
// ===========================================================================

// ---------------------------------------------------------------------------
// upsertSubscription
//   Idempotent. ON CONFLICT (stripe_subscription_id) DO UPDATE means calling
//   this with the same data twice is safe and produces the same result.
// ---------------------------------------------------------------------------
async function upsertSubscription(
  sub: Stripe.Subscription,
  db: SupabaseClient,
): Promise<void> {
  const customerId = stripeId(sub.customer)
  const userId     = await resolveUser(customerId, db)

  if (!userId) {
    console.warn(
      `[stripe-webhook] Cannot upsert subscription ${sub.id}: ` +
      `no local user for Stripe customer ${customerId}`,
    )
    return
  }

  // Use the first line item's price to identify the local product.
  const stripePriceId = sub.items.data[0]?.price?.id
  if (!stripePriceId) {
    console.warn(`[stripe-webhook] No price on subscription ${sub.id}`)
    return
  }

  const { data: localPrice, error: priceErr } = await db
    .from('prices')
    .select('id, product_id')
    .eq('stripe_price_id', stripePriceId)
    .single()

  if (priceErr || !localPrice) {
    throw new Error(
      `Local price not found for stripe_price_id ${stripePriceId}. ` +
      'Ensure prices are synced with Stripe before processing subscriptions.',
    )
  }

  const { error } = await db.from('subscriptions').upsert(
    {
      user_id:                 userId,
      product_id:              localPrice.product_id,
      price_id:                localPrice.id,
      stripe_subscription_id:  sub.id,
      stripe_customer_id:      customerId!,
      status:                  sub.status,
      current_period_start:    epochToISO(sub.current_period_start),
      current_period_end:      epochToISO(sub.current_period_end),
      cancel_at_period_end:    sub.cancel_at_period_end,
      canceled_at:             sub.canceled_at ? epochToISO(sub.canceled_at) : null,
      trial_end:               sub.trial_end   ? epochToISO(sub.trial_end)   : null,
      updated_at:              now(),
    },
    { onConflict: 'stripe_subscription_id' },
  )

  if (error) throw error
}

// ---------------------------------------------------------------------------
// resolveUser
//   Looks up the local user UUID from the stripe_customers table.
//   Returns null for guest checkouts or if the mapping doesn't exist yet.
// ---------------------------------------------------------------------------
async function resolveUser(
  stripeCustomerId: string | null,
  db: SupabaseClient,
): Promise<string | null> {
  if (!stripeCustomerId) return null

  const { data } = await db
    .from('stripe_customers')
    .select('user_id')
    .eq('stripe_customer_id', stripeCustomerId)
    .single()

  return data?.user_id ?? null
}

// ---------------------------------------------------------------------------
// triggerDiscordProvisioning
//   Calls the `provision-discord` Edge Function if the product has a
//   discord_role_id in its metadata. Failures are logged but non-fatal —
//   a failed Discord grant should not cause Stripe to retry the payment event.
// ---------------------------------------------------------------------------
async function triggerDiscordProvisioning(
  productId: string,
  userId: string,
  db: SupabaseClient,
): Promise<void> {
  const { data: product } = await db
    .from('products')
    .select('metadata')
    .eq('id', productId)
    .single()

  const discordRoleId = (product?.metadata as Record<string, unknown>)?.discord_role_id
  if (!discordRoleId) return

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/provision-discord`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        Authorization:   `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ user_id: userId, discord_role_id: discordRoleId }),
    })

    if (!res.ok) {
      console.error(
        `[stripe-webhook] provision-discord returned ${res.status}`,
      )
    } else {
      console.log(
        `[stripe-webhook] Discord role ${discordRoleId} provisioned for user ${userId}`,
      )
    }
  } catch (err) {
    // Non-fatal. A background job or manual retry can re-grant the role.
    console.error(`[stripe-webhook] provision-discord fetch error: ${err}`)
  }
}

// ===========================================================================
// Utilities
// ===========================================================================

/** Extracts the string ID from a Stripe expandable field or returns null. */
function stripeId(field: string | { id: string } | null | undefined): string | null {
  if (!field) return null
  return typeof field === 'string' ? field : field.id
}

/** Converts a Unix epoch (seconds) to an ISO 8601 string. */
function epochToISO(epoch: number): string {
  return new Date(epoch * 1000).toISOString()
}

/** Current timestamp as ISO 8601 string. */
function now(): string {
  return new Date().toISOString()
}

/** Returns true if the error is a Postgres unique_violation (code 23505). */
function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === '23505'
}
