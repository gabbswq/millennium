'use client'

import { useCallback, useRef, useState } from 'react'
import { authCaptchaConfiguration, usableCaptchaToken } from '@/lib/auth/captcha'

export function useAuthCaptcha() {
  const configuration = authCaptchaConfiguration()
  const token = useRef<string | undefined>(undefined)
  const [verified, setVerified] = useState(false)
  const [version, setVersion] = useState(0)
  const onToken = useCallback((value?: string) => {
    token.current = usableCaptchaToken(value) ? value : undefined
    setVerified(token.current !== undefined)
  }, [])
  const takeToken = useCallback(() => {
    const value = token.current
    token.current = undefined
    setVerified(false)
    return value
  }, [])
  const reset = useCallback(() => { onToken(); setVersion(value => value + 1) }, [onToken])
  return { configuration, ready: !configuration.enabled || configuration.valid && verified, version, onToken, takeToken, reset }
}

export type AuthCaptchaControl = ReturnType<typeof useAuthCaptcha>
