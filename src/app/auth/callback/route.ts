import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeAuthNextPath } from '@/lib/auth/redirect'

function getSafeRedirectUrl(request: NextRequest, redirectTo: string | null) {
  return new URL(safeAuthNextPath(redirectTo), request.url)
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const redirectTo = requestUrl.searchParams.get('next')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(getSafeRedirectUrl(request, redirectTo))
    }
  }

  return NextResponse.redirect(new URL('/auth/login', request.url))
}
