import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { providerRecord } from '@/lib/auth/provider'
import { boundedBody, apiError } from '@/lib/stripe/http'
import { requestBudget } from '@/lib/stripe/guards'
import { OnboardingError } from '@/lib/stripe/onboarding'

const syncProviderSchema = z.object({
  provider: z.string().trim().min(1).max(64).refine((value) => value !== 'email'),
}).strict()

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get('authorization')
  const [scheme, token] = authorization?.split(' ') ?? []

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null
  }

  return token
}

async function syncProvider(request: NextRequest) {
  requestBudget.take('provider-sync-ingress', 30)
  const token = getBearerToken(request)

  if (!token) {
    return NextResponse.json({ error: 'Missing bearer token.' }, { status: 401 })
  }

  let payload: z.infer<typeof syncProviderSchema>

  try {
    payload = syncProviderSchema.parse(JSON.parse(await boundedBody(request, 1024)))
  } catch (error) {
    if (error instanceof OnboardingError) throw error
    return NextResponse.json({ error: 'Invalid provider payload.' }, { status: 400 })
  }

  requestBudget.take('provider-sync-authentication', 30)
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token)

  if (userError || !user) {
    return NextResponse.json({ error: 'Invalid bearer token.' }, { status: 401 })
  }

  const record = providerRecord(user, payload.provider)
  if (!record) return NextResponse.json({ error: 'Verified provider identity required.' }, { status: 403 })
  requestBudget.take(`provider-sync:${user.id}`, 3)

  const admin = createAdminClient()
  const { error } = await admin.from('auth_providers').upsert(
    record,
    { onConflict: 'provider,provider_user_id' },
  )

  if (error) {
    console.error('[auth/sync-provider] Failed to sync provider.', {
      user_id: user.id,
      provider: payload.provider,
      code: error.code,
    })

    return NextResponse.json({ error: 'Failed to sync provider.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function POST(request: NextRequest) {
  try {
    const response = await syncProvider(request)
    response.headers.set('Cache-Control', 'private, no-store')
    return response
  } catch (error) { return apiError(error) }
}
