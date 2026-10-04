import http from 'node:http'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Disposable loopback auth/REST fixture. Never enabled in application code or deployed.
const id = '00000000-0000-4000-8000-000000000001'
const priceId = '10000000-0000-4000-8000-000000000001'
const tokens = new Map()
const captchaMode = process.argv.includes('--captcha')
const appPort = captchaMode ? 4315 : 4313, authPort = captchaMode ? 4316 : 4314
const usedCaptcha = new Set()
function session(email) {
  const confirmed = email !== 'pending@example.test'
  const user = { id, aud: 'authenticated', role: 'authenticated', email, email_confirmed_at: confirmed ? '2026-10-03T00:00:00Z' : null,
    confirmed_at: confirmed ? '2026-10-03T00:00:00Z' : null, is_anonymous: false, app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, created_at: '2026-10-03T00:00:00Z' }
  const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now()/1000)+3600, aud: 'authenticated' })).toString('base64url')}.${Buffer.from(email).toString('base64url')}`
  tokens.set(token, user)
  return { access_token: token, refresh_token: 'fixture-only', token_type: 'bearer', expires_in: 3600, user }
}
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', `http://127.0.0.1:${appPort}`)
  res.setHeader('Access-Control-Allow-Headers', 'authorization,apikey,content-type,x-client-info,x-supabase-api-version')
  res.setHeader('Content-Type', 'application/json')
  if (req.method === 'OPTIONS') { res.end(); return }
  const url = new URL(req.url, `http://127.0.0.1:${authPort}`)
  const user = tokens.get(req.headers.authorization?.replace(/^Bearer /i, ''))
  if (['/auth/v1/token', '/auth/v1/signup', '/auth/v1/recover', '/auth/v1/resend'].includes(url.pathname)) {
    let raw = ''; for await (const chunk of req) raw += chunk
    const body = JSON.parse(raw)
    const captcha = body.gotrue_meta_security?.captcha_token
    if (captchaMode && (typeof captcha !== 'string' || !captcha.startsWith('fixtureCaptcha_') || usedCaptcha.has(captcha))) {
      res.statusCode = 400; res.end(JSON.stringify({ msg: 'captcha verification process failed', error_code: 'captcha_failed' })); return
    }
    if (captchaMode) usedCaptcha.add(captcha)
    if (url.pathname === '/auth/v1/signup') {
      res.end(JSON.stringify({ user: { ...session(body.email).user, email_confirmed_at: null, confirmed_at: null } })); return
    }
    if (url.pathname === '/auth/v1/recover' || url.pathname === '/auth/v1/resend') {
      if (body.email === 'serverfail@example.test') {
        res.statusCode = 429; res.end(JSON.stringify({ msg: 'Email rate limit exceeded', error_code: 'over_email_send_rate_limit' })); return
      }
      res.end('{}'); return
    }
    if (body.password !== 'FixturePass1!') { res.statusCode = 400; res.end(JSON.stringify({ msg: 'Invalid login credentials', error_code: 'invalid_credentials' })); return }
    res.end(JSON.stringify(session(body.email))); return
  }
  if (url.pathname === '/auth/v1/user') {
    res.statusCode = user ? 200 : 401; res.end(JSON.stringify(user ?? { msg: 'Invalid token' })); return
  }
  if (url.pathname === '/auth/v1/logout') { res.end('{}'); return }
  if (url.pathname.startsWith('/rest/v1/') && !user) { res.statusCode = 401; res.end('{}'); return }
  if (url.pathname === '/rest/v1/prices') {
    res.end(JSON.stringify([{ id: priceId, product_id: priceId, amount_cents: 1000, currency: 'brl', interval: null }])); return
  }
  if (url.pathname === '/rest/v1/products') { res.end(JSON.stringify([{ id: priceId, title: 'Produto de teste' }])); return }
  if (url.pathname === '/rest/v1/stripe_checkout_requests') {
    res.end(JSON.stringify([{ id: '20000000-0000-4000-8000-000000000001', price_id: priceId, amount_cents: 1000,
      currency: 'brl', creation_state: 'BOUND', payment_state: 'pending', created_at: '2026-10-03T00:00:00Z' }])); return
  }
  res.statusCode = 404; res.end('{}')
})
server.listen(authPort, '127.0.0.1')
const child = spawn(process.execPath, [fileURLToPath(new URL('../../node_modules/next/dist/bin/next', import.meta.url)), 'dev', '--hostname', '127.0.0.1', '--port', String(appPort)], {
  stdio: 'inherit', windowsHide: true, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', MILLENNIUM_E2E: 'true',
    NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${authPort}`, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-public-key',
    NEXT_PUBLIC_AUTH_CAPTCHA_ENABLED: captchaMode ? 'true' : 'false',
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: captchaMode ? '0xFixturePublicSiteKey' : '',
    MILLENNIUM_APP_ORIGIN: `http://127.0.0.1:${appPort}`, STRIPE_CHECKOUT_ENABLED: 'false', STRIPE_CONNECT_ENABLED: 'false',
    STRIPE_SECRET_KEY: '', SUPABASE_SERVICE_ROLE_KEY: '', STRIPE_CONNECT_WEBHOOK_SECRET: '', STRIPE_CHECKOUT_WEBHOOK_SECRET: '',
  },
})
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
  else child.kill()
  server.closeAllConnections(); server.close()
})
child.on('exit', code => { server.close(); process.exitCode = code ?? 0 })
