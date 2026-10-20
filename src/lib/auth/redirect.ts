const AUTH_REDIRECT_BASE = 'https://millennium.invalid'

export function safeAuthNextPath(value: string | null | undefined, fallback = '/dashboard') {
  if (!value) return fallback

  try {
    const target = new URL(value, AUTH_REDIRECT_BASE)
    if (target.origin !== AUTH_REDIRECT_BASE) return fallback
    return `${target.pathname}${target.search}${target.hash}`
  } catch {
    return fallback
  }
}
