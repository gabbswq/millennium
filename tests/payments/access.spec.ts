import { test, expect, type Page } from '@playwright/test'

async function login(page: Page, email = 'owner@example.test') {
  await page.goto('/auth/login')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill('FixturePass1!')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}
test('entry requires login and preserves keyboard access to password recovery', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/auth\/login$/)
  await expect(page.getByRole('heading', { name: 'Entrar no Millennium' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continuar com Google' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Esqueceu a senha?' })).not.toHaveAttribute('tabindex', '-1')
  await expect(page.getByRole('link', { name: 'Criar conta' })).toBeVisible()
  const password = page.getByLabel('Senha', { exact: true })
  await password.fill('SenhaDeTeste1!')
  await page.locator('[aria-label="Mostrar senha"]').click()
  await expect(password).toHaveAttribute('type', 'text')
  await page.locator('[aria-label="Ocultar senha"]').click()
  await expect(password).toHaveAttribute('type', 'password')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  if (test.info().project.name === 'mobile') {
    await expect(page.getByRole('heading', { name: 'Seu próximo passo começa com clareza.' })).toBeHidden()
  } else {
    await expect(page.getByRole('heading', { name: 'Seu próximo passo começa com clareza.' })).toBeVisible()
  }
  const mark = page.locator('img[alt=""]').first()
  expect(await mark.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
  await page.screenshot({ path: `test-results/login-auth-redesign-${test.info().project.name}.png`, fullPage: true })
})
test('disabled Google provider keeps the user on login with a readable error', async ({ page }) => {
  await page.goto('/auth/login')
  await page.getByRole('button', { name: 'Continuar com Google' }).click()
  await expect(page).toHaveURL(/\/auth\/login$/)
  await expect(page.locator('.auth-error')).toContainText('Google ainda não foi ativado')
})
test('invalid email credentials stay on login and show a localized error', async ({ page }) => {
  await page.goto('/auth/login')
  await page.getByLabel('Email', { exact: true }).fill('invalid@example.test')
  await page.getByLabel('Senha', { exact: true }).fill('WrongFixturePass1!')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/auth\/login$/)
  await expect(page.locator('.auth-error')).toHaveText('Email ou senha incorretos.')
  expect(page.url()).not.toContain('invalid@example.test')
  expect(page.url()).not.toContain('WrongFixturePass1!')
})

test('email signup can verify the six-digit confirmation code and establish a session', async ({ page }) => {
  await page.goto('/auth/signup')
  await page.getByLabel('Nome', { exact: true }).fill('Usuario de teste')
  await page.getByLabel('Email', { exact: true }).fill('signup@example.test')
  await page.getByLabel('Senha', { exact: true }).fill('FixturePass1!')
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Verifique seu email' })).toBeVisible()
  await page.getByLabel('Código de confirmação').fill('123456')
  await page.getByRole('button', { name: 'Confirmar email' }).click()
  await expect(page).toHaveURL(/\/dashboard\/checkout$/)
})

test('invalid email confirmation code stays visible and offers a retry', async ({ page }) => {
  await page.goto('/auth/signup')
  await page.getByLabel('Nome', { exact: true }).fill('Usuario de teste')
  await page.getByLabel('Email', { exact: true }).fill('signup@example.test')
  await page.getByLabel('Senha', { exact: true }).fill('FixturePass1!')
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click()
  await page.getByLabel('Código de confirmação').fill('000000')
  await page.getByRole('button', { name: 'Confirmar email' }).click()
  await expect(page.locator('p[role="alert"]')).toHaveText('O link ou código expirou ou é inválido. Solicite um novo.')
  await expect(page.getByRole('heading', { name: 'Verifique seu email' })).toBeVisible()
})

test('confirmation callback reports failure instead of silently returning to login', async ({ page }) => {
  await page.goto('/auth/callback?error=access_denied&error_code=otp_expired')
  await expect(page).toHaveURL(/\/auth\/login\?auth_error=confirmation_expired$/)
  await expect(page.locator('.auth-error')).toContainText('A confirmação expirou ou já foi usada')
})
test('pending email cannot open Checkout or sellers', async ({ page }) => {
  await login(page, 'pending@example.test')
  await expect(page).toHaveURL(/\/auth\/verify$/)
  await page.goto('/dashboard/vendedores')
  await expect(page).toHaveURL(/\/auth\/verify$/)
  await expect(page.getByRole('heading', { name: 'Confirme seu email' })).toBeVisible()
})
test('Checkout and sellers are independent menu destinations, disabled without provider configuration', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await login(page)
  await expect(page).toHaveURL(/\/dashboard\/checkout$/)
  await expect(page.getByRole('heading', { name: 'Checkout', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Abrir Checkout' })).toBeDisabled()
  await expect(page.getByText('Aguardando pagamento', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Vendedores', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Vendedores', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continuar cadastro na Stripe' })).toBeDisabled()
  await expect(page.getByText('Integracao de vendedores ainda nao configurada.')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: `test-results/sellers-${test.info().project.name}.png`, fullPage: true })
  await page.getByRole('link', { name: 'Checkout', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard\/checkout$/)
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await expect(page).toHaveURL(/\/auth\/login$/)
  await page.goto('/dashboard/checkout')
  await expect(page).toHaveURL(/\/auth\/login$/)
  expect(errors).toEqual([])
})
test('mutation routes reject cross-origin input before authentication', async ({ request }) => {
  for (const path of ['/api/checkout', '/api/stripe/onboarding']) {
    const response = await request.post(path, { headers: { Origin: 'https://evil.test' }, data: { destination: 'acct_evil' } })
    expect(response.status()).toBe(403)
    expect(response.headers()['cache-control']).toContain('no-store')
  }
})
test('verified fixture identity still cannot bypass disabled Stripe integration', async ({ page }) => {
  await login(page)
  await expect(page).toHaveURL(/\/dashboard\/checkout$/)
  const result = await page.evaluate(async () => {
    const response = await fetch('/api/stripe/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    return { status: response.status, body: await response.json() }
  })
  expect(result.status).toBe(503)
  expect(result.body.url).toBeUndefined()
})

test('OAuth sync refuses client identity claims and oversized bodies before touching providers', async ({ request }) => {
  const missing = await request.post('/api/auth/sync-provider', { data: { provider: 'google' } })
  expect(missing.status()).toBe(401)
  const forged = await request.post('/api/auth/sync-provider', { headers: { Authorization: 'Bearer fixture-not-authenticated' },
    data: { provider: 'google', provider_user_id: 'forged', provider_data: { role: 'admin' } } })
  expect(forged.status()).toBe(400)
  const oversized = await request.post('/api/auth/sync-provider', { headers: { Authorization: 'Bearer fixture-not-authenticated' },
    data: { provider: 'g'.repeat(1500) } })
  expect(oversized.status()).toBe(413)
  expect(oversized.headers()['cache-control']).toContain('no-store')
})
