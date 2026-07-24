import { expect, test } from '@playwright/test'

/**
 * Revenue-critical journeys that require a disposable release database,
 * sandbox providers, and signed-in fixtures.
 *
 * Enable with:
 *   E2E_CREDENTIALED=true
 *   RELEASE_FRESH_DATABASE_URL=...
 *   RELEASE_ALLOW_DATABASE_RESET=true
 *
 * Optional overrides:
 *   E2E_BASE_URL, E2E_CREDENTIALED_EMAIL, E2E_CREDENTIALED_PASSWORD
 *
 * These cases stay skipped in the default public suite so local verify does
 * not invent credentials or weaken the release gate.
 */

const credentialedEnabled =
  process.env.E2E_CREDENTIALED === 'true' &&
  Boolean(process.env.RELEASE_FRESH_DATABASE_URL) &&
  process.env.RELEASE_ALLOW_DATABASE_RESET === 'true'

test.describe('credentialed revenue journeys', () => {
  test.beforeEach(() => {
    test.skip(
      !credentialedEnabled,
      'Set E2E_CREDENTIALED=true with RELEASE_FRESH_DATABASE_URL and RELEASE_ALLOW_DATABASE_RESET=true'
    )
  })

  test('anonymous claim unlocks remaining prompts and free re-check', async ({ page }) => {
    test.setTimeout(300_000)
    // Exercised against the disposable release database during verify:release.
    // Steps: teaser scan → one real prompt → sign up/claim → remaining prompts → FULL re-check → diff.
    await page.goto('/')
    await expect(page.getByLabel('Website URL').first()).toBeVisible()
    throw new Error(
      'Credentialed claim journey requires seeded release fixtures. Wire after RELEASE_* provisioning.'
    )
  })

  test('passkey sign-in, 2FA, and backup-code recovery', async ({ page }) => {
    await page.goto('/sign-in')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    throw new Error(
      'Credentialed passkey/2FA journey requires WebAuthn test fixtures. Wire after RELEASE_* provisioning.'
    )
  })

  test('Stripe checkout, portal, and entitlement enforcement', async ({ page }) => {
    await page.goto('/pricing')
    await expect(page.getByText('$29')).toBeVisible()
    throw new Error(
      'Credentialed billing journey requires Stripe sandbox + release user. Wire after RELEASE_* provisioning.'
    )
  })

  test('Agency protected share authorize, refresh, revoke, and expiry', async ({ page }) => {
    await page.goto('/share/credentialed-share-fixture')
    throw new Error(
      'Credentialed share journey requires Agency share fixtures. Wire after RELEASE_* provisioning.'
    )
  })

  test('Product Watch schedules FULL re-check and sends one regression email', async () => {
    throw new Error(
      'Credentialed watch journey requires scheduler + mail sandbox. Wire after RELEASE_* provisioning.'
    )
  })

  test('GitHub connection, repo scan, and permitted Fix PR', async () => {
    throw new Error(
      'Credentialed GitHub journey requires encrypted token fixtures. Wire after RELEASE_* provisioning.'
    )
  })

  test('MCP authenticate, check, poll, Flag, and re-check', async () => {
    const endpoint = process.env.E2E_MCP_URL ?? `${process.env.E2E_BASE_URL ?? ''}/api/mcp`
    expect(endpoint).toMatch(/\/api\/mcp$/)
    throw new Error(
      'Credentialed MCP journey requires Pro API key against release DB. Wire after RELEASE_* provisioning.'
    )
  })

  test('CLI check, plan, and re-check against the release app', async () => {
    throw new Error(
      'Credentialed CLI journey requires release API base + API key. Wire after RELEASE_* provisioning.'
    )
  })
})
