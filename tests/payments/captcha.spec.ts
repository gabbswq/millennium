import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const script = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
async function solve(page: Page) { await page.getByRole('button', { name: 'Concluir verificacao ficticia' }).click() }
async function signup(page: Page, email = 'new@example.test') {
  await page.goto('/auth/signup')
  await page.getByLabel('Nome', { exact: true }).fill('Usuario de teste')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Senha', { exact: true }).fill('FixturePass1!')
  await solve(page)
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Verifique seu email' })).toBeVisible()
}
test.beforeEach(async ({ page }) => {
  await page.route(script, async route => route.fulfill({ contentType: 'application/javascript',
    body: await readFile(resolve(__dirname, 'captcha-fixture.mjs'), 'utf8') }))
})

test('password login requires a challenge; consumed or expired tokens cannot enable another attempt', async ({ page }) => {
  const errors: string[] = [], requests: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (request.method() === 'POST' && request.url().includes('/auth/v1/token')) requests.push(request.postData() ?? '') })
  await page.goto('/auth/login')
  await page.getByLabel('Email', { exact: true }).fill('owner@example.test')
  await page.getByLabel('Senha', { exact: true }).fill('IncorrectPass1!')
  const submit = page.getByRole('button', { name: 'Entrar', exact: true })
  await expect(submit).toBeDisabled()
  await solve(page)
  await expect(submit).toBeEnabled()
  await page.evaluate(() => (window as unknown as { __captchaFixture: { expire(): void } }).__captchaFixture.expire())
  await expect(submit).toBeDisabled()
  await page.getByLabel('Senha', { exact: true }).press('Enter')
  expect(requests).toHaveLength(0)
  await page.locator('form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  await expect(page.locator('p[role="alert"]')).toBeVisible()
  expect(requests).toHaveLength(0)
  await solve(page); await submit.click()
  await expect(page.locator('p[role="alert"]')).toBeVisible()
  await expect(submit).toBeDisabled()
  expect(requests).toHaveLength(1)
  const token = JSON.parse(requests[0]).gotrue_meta_security.captcha_token
  expect(token).toMatch(/^fixtureCaptcha_/)
  await page.getByLabel('Senha', { exact: true }).fill('FixturePass1!')
  await solve(page); await submit.click()
  await expect(page).toHaveURL(/\/dashboard\/checkout$/)
  expect(requests).toHaveLength(2)
  expect(JSON.parse(requests[1]).gotrue_meta_security.captcha_token).not.toBe(token)
  expect(errors).toEqual([])
})
test('signup and resend use different single-use tokens; a failed resend never claims success', async ({ page }) => {
  const requests: { path: string; token: string }[] = []
  page.on('request', request => {
    if (request.method() === 'POST' && /\/auth\/v1\/(signup|resend)/.test(request.url())) {
      requests.push({ path: new URL(request.url()).pathname, token: request.postDataJSON().gotrue_meta_security.captcha_token })
    }
  })
  await signup(page, 'serverfail@example.test')
  const resend = page.getByRole('button', { name: 'Reenviar email de confirmação' })
  await expect(resend).toBeDisabled()
  await solve(page); await resend.click()
  await expect(page.locator('p[role="alert"]')).toBeVisible()
  await expect(page.getByText('Email reenviado. Verifique sua caixa de entrada (e spam).')).toHaveCount(0)
  expect(requests.map(item => item.path)).toEqual(['/auth/v1/signup', '/auth/v1/resend'])
  expect(requests[0].token).not.toBe(requests[1].token)
  await expect(resend).toBeDisabled()
})
test('password recovery carries the challenge and does not disclose whether the address exists', async ({ page }) => {
  await page.goto('/auth/forgot')
  await page.getByLabel('Email', { exact: true }).fill('unknown@example.test')
  const submit = page.getByRole('button', { name: 'Enviar link de recuperação' })
  await expect(submit).toBeDisabled()
  await solve(page)
  const request = page.waitForRequest(request => request.method() === 'POST' && request.url().includes('/auth/v1/recover'))
  await submit.click()
  expect((await request).postDataJSON().gotrue_meta_security.captcha_token).toMatch(/^fixtureCaptcha_/)
  await expect(page.getByText(/Se esse email estiver cadastrado/)).toBeVisible()
})
test('script failure fails closed instead of submitting authentication', async ({ page }) => {
  await page.unroute(script)
  await page.route(script, route => route.abort('failed'))
  await page.goto('/auth/login')
  await expect(page.getByText('Verificacao de seguranca indisponivel.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeDisabled()
})

test('widget errors invalidate an already verified challenge', async ({ page }) => {
  await page.goto('/auth/login')
  const submit = page.getByRole('button', { name: 'Entrar', exact: true })
  await solve(page)
  await expect(submit).toBeEnabled()
  await page.evaluate(() => (window as unknown as { __captchaFixture: { fail(): void } }).__captchaFixture.fail())
  await expect(page.getByText('Verificacao de seguranca indisponivel.')).toBeVisible()
  await expect(submit).toBeDisabled()
})
test('challenge fits narrow screens, adapts to resize and keeps keyboard focus visible', async ({ page }) => {
  await page.goto('/auth/login')
  await expect(page.getByRole('button', { name: 'Concluir verificacao ficticia' })).toBeVisible()
  await page.setViewportSize({ width: 320, height: 844 })
  await expect(page.getByRole('button', { name: 'Concluir verificacao ficticia' })).toHaveAttribute('data-size', 'compact')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: `test-results/auth-captcha/320-${test.info().project.name}.png`, fullPage: true })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await expect(page.getByRole('button', { name: 'Concluir verificacao ficticia' })).toHaveAttribute('data-size', 'flexible')
  await page.getByLabel('Senha', { exact: true }).focus()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Concluir verificacao ficticia' })).toBeFocused()
  await page.screenshot({ path: `test-results/auth-captcha/desktop-${test.info().project.name}.png`, fullPage: true })
})
