import { NextResponse } from 'next/server'
import { accountAccess } from '@/lib/stripe/server'
import { apiError } from '@/lib/stripe/http'

export const dynamic = 'force-dynamic'
export async function GET() {
  try {
    const context = await accountAccess()
    return NextResponse.json({ ...context.kyc, reason: context.reason }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return apiError(error) }
}
