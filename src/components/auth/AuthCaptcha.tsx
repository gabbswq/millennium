'use client'

import Script from 'next/script'
import { useEffect, useRef, useState } from 'react'
import type { AuthCaptchaControl } from '@/hooks/useAuthCaptcha'

interface Turnstile {
  render(container: HTMLElement, options: { sitekey: string; theme: 'dark'; size: 'flexible' | 'compact';
    'response-field': false; retry: 'never'; callback: (token: string) => void;
    'expired-callback': () => void; 'error-callback': () => boolean }): string | undefined
  reset(id: string): void
  remove(id: string): void
}
function api(): Turnstile | undefined { return (window as Window & { turnstile?: Turnstile }).turnstile }

export function AuthCaptcha({ control }: { control: AuthCaptchaControl }) {
  const { configuration: { enabled, valid, siteKey }, onToken, version } = control
  const container = useRef<HTMLDivElement>(null)
  const widget = useRef<string | undefined>(undefined)
  const previousVersion = useRef(version)
  const [scriptStatus, setScriptStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [widgetError, setWidgetError] = useState(false)
  const [size, setSize] = useState<'flexible' | 'compact'>('compact')

  useEffect(() => {
    if (!enabled || !valid || !container.current) return
    const element = container.current
    const measure = () => setSize(element.clientWidth >= 300 ? 'flexible' : 'compact')
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [enabled, valid])

  useEffect(() => {
    if (!enabled || !valid || scriptStatus !== 'loading') return
    const timer = setTimeout(() => setScriptStatus('error'), 15000)
    return () => clearTimeout(timer)
  }, [enabled, valid, scriptStatus])

  useEffect(() => {
    const turnstile = scriptStatus === 'ready' ? api() : undefined
    if (!enabled || !valid || !siteKey || !container.current || !turnstile) return
    let active = true
    const receive = (value?: string) => { if (active) onToken(value) }
    try {
      setWidgetError(false)
      widget.current = turnstile.render(container.current, { sitekey: siteKey, theme: 'dark', size,
        'response-field': false, retry: 'never',
        callback: value => { if (active) setWidgetError(false); receive(value) },
        'expired-callback': () => receive(),
        'error-callback': () => { if (active) setWidgetError(true); receive(); return true },
      })
      if (widget.current === undefined) { receive(); setWidgetError(true) }
    } catch { receive(); setWidgetError(true) }
    return () => {
      active = false
      onToken()
      if (widget.current !== undefined) { try { turnstile.remove(widget.current) } catch { /* Removed by navigation. */ } }
      widget.current = undefined
    }
  }, [enabled, valid, siteKey, size, scriptStatus, onToken])

  useEffect(() => {
    if (previousVersion.current === version) return
    previousVersion.current = version
    if (widget.current !== undefined) {
      try { api()?.reset(widget.current) } catch { onToken(); setWidgetError(true) }
    }
  }, [version, onToken])

  if (!enabled) return null
  if (!valid) return <p role="alert" className="text-sm text-destructive">Verificacao de seguranca indisponivel.</p>
  return <>
    <Script id="millennium-turnstile" src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
      strategy="afterInteractive" onReady={() => setScriptStatus('ready')} onError={() => { onToken(); setScriptStatus('error') }} />
    <div ref={container} aria-label="Verificacao de seguranca" className="flex w-full justify-center"
      style={{ minHeight: size === 'compact' ? 140 : 65 }} />
    {(scriptStatus === 'error' || widgetError) && <p role="alert" className="text-sm text-destructive">Verificacao de seguranca indisponivel.</p>}
  </>
}
