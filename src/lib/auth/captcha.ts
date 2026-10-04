import { AuthError } from '@supabase/supabase-js'

export function authCaptchaConfiguration(enabled = process.env.NEXT_PUBLIC_AUTH_CAPTCHA_ENABLED,
  siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
  if (enabled === undefined || enabled === 'false') return { enabled: false, valid: true, siteKey: null }
  const valid = enabled === 'true' && typeof siteKey === 'string' && /^[A-Za-z0-9_-]{3,100}$/.test(siteKey)
  return { enabled: true, valid, siteKey: valid ? siteKey! : null }
}

export function usableCaptchaToken(token: unknown): token is string {
  return typeof token === 'string' && token.length > 0 && token.length <= 2048 && token.trim() === token
}

export async function captchaProtected(token: string | undefined,
  action: (options: { captchaToken?: string }) => Promise<{ error: AuthError | null }>,
  configuration = authCaptchaConfiguration()): Promise<{ error: AuthError | null }> {
  if (configuration.enabled && (!configuration.valid || !usableCaptchaToken(token))) {
    return { error: new AuthError(configuration.valid ? 'captcha_missing' : 'captcha_configuration_unavailable', 400, 'captcha_failed') }
  }
  try { return { error: (await action(configuration.enabled ? { captchaToken: token } : {})).error } }
  catch { return { error: new AuthError('auth_request_unavailable', 503) } }
}
