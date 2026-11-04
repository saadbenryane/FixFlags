import { expect, test, type Page } from '@playwright/test'

/** Authenticate fixtures through the real UI while respecting server admission. */
export async function signInFixture(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/sign-in')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)

  for (let attempt = 1; attempt <= 3; attempt++) {
    const origin = new URL(page.url()).origin
    const matchesSignIn = (url: string, method: string) => {
      const target = new URL(url)
      return method === 'POST' && target.origin === origin && target.pathname === '/api/auth/sign-in/email'
    }
    const [submitted, response] = await Promise.all([
      page.waitForRequest(request => matchesSignIn(request.url(), request.method()), { timeout: 30_000 }),
      page.waitForResponse(response => matchesSignIn(response.url(), response.request().method()), { timeout: 30_000 }),
      page.getByRole('button', { name: 'Sign in', exact: true }).click(),
    ])
    expect(response.request() === submitted, 'Server acceptance must belong to the observed fixture submission').toBe(true)
    expect(submitted.postDataJSON()?.email, 'The submitted identity must match the entered fixture').toBe(email.trim())
    if (response.status() !== 429) {
      expect(response.status(), 'Fixture sign-in must receive normal server acceptance').toBe(200)
      return
    }

    const headers = response.headers()
    const header = headers['retry-after'] !== undefined ? 'retry-after' : 'x-retry-after'
    const seconds = Number(headers[header])
    expect(Number.isInteger(seconds) && seconds > 0 && seconds <= 30,
      'Rate-limited fixture sign-in requires a bounded server retry instruction').toBe(true)
    await expect(page.getByRole('alert').filter({ hasText: /too many|wait|try again/i })).toBeVisible()
    await test.info().attach(`fixture-sign-in-rate-limit-${attempt}`, {
      contentType: 'application/json',
      body: Buffer.from(JSON.stringify({ observedAt: new Date().toISOString(), status: response.status(), attempt,
        maximumAttempts: 3, header, retryAfterSeconds: seconds, limitsChanged: false })),
    })
    expect(attempt, 'Fixture authentication must settle within its bounded attempts').toBeLessThan(3)
    // Wait for the server's real window. Do not reset counters or alter clocks.
    await new Promise(resolve => setTimeout(resolve, (seconds + 1) * 1000))
  }
}
