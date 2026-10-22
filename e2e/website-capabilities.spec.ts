import { signInFixture } from './fixture-authentication'
import { expect, test, type APIRequestContext } from '@playwright/test'
import { ACCOUNT_CHECK_COPY } from '@/lib/marketing/copy/account-checks'
import type { SiteHomeView } from '@/lib/sites/site-home'
import type { AccountChecksView } from '@/lib/sites/accounts/contracts'
import type { UptimeHistory } from '@/lib/uptime/domain'

const required = (name: string) => {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required for website capability proof`)
  return value
}
type Home = Pick<SiteHomeView, 'audit' | 'flags' | 'resolvedFlags' | 'settings'>
const accounts = (view: Home): AccountChecksView => {
  expect(view.settings.accountChecks, 'Site account projection is available').toBeDefined()
  return view.settings.accountChecks!
}
async function home(request: APIRequestContext, siteId: string): Promise<Home> {
  const response = await request.get(`/api/sites/${siteId}`)
  expect(response.status(), await response.text()).toBe(200)
  return response.json()
}
async function control(request: APIRequestContext, data: Record<string, boolean | number>) {
  const response = await request.post(required('E2E_DEPLOYMENT_TRIGGER_URL'), {
    headers: { authorization: `Bearer ${required('E2E_DEPLOYMENT_TRIGGER_TOKEN')}` }, data,
  })
  expect(response.status(), await response.text()).toBe(200)
}
async function run(request: APIRequestContext, siteId: string, path: string, data: unknown, key: string) {
  const response = await request.post(`/api/sites/${siteId}/${path}`, { headers: { 'Idempotency-Key': key }, data })
  expect([200, 202], await response.text()).toContain(response.status())
  const admitted = await response.json() as { runId: string }
  await expect.poll(async () => {
    const receipt = await request.get(`/api/sites/${siteId}/runs/${admitted.runId}`)
    expect(receipt.status()).toBe(200)
    return (await receipt.json()).status
  }, { timeout: 420_000, intervals: [1000] }).toBe('COMPLETED')
  return admitted
}

test.describe('controlled website capabilities', () => {
  test.describe.configure({ mode: 'serial' })
  test.beforeEach(async ({ page }) => {
    test.skip(process.env.E2E_CREDENTIALED !== 'true', 'Requires the designated credentialed verification environment')
    const origin = new URL(required('RELEASE_ENV_URL'))
    if (['fixflags.com', 'www.fixflags.com'].includes(origin.hostname)) throw new Error('Capability fixtures must never target production')
    await signInFixture(page, required('E2E_CAPABILITY_OWNER_EMAIL'), required('E2E_CAPABILITY_OWNER_PASSWORD'))
    await page.waitForURL(url => !url.pathname.startsWith('/sign-in'))
  })

  test('[journey:category-recheck] frozen scope, replay and independent title recovery', async ({ page }) => {
    test.setTimeout(900_000)
    const siteId = required('E2E_CAPABILITY_SITE_ID'), source = await home(page.request, siteId)
    const key = `category-failure:${required('RELEASE_RUN_ID')}`
    try {
      await control(page.request, { missingTitle: true })
      const failure = await run(page.request, siteId, 'runs', { scope: 'category', area: 'search' }, key)
      const replay = await page.request.post(`/api/sites/${siteId}/runs`, { headers: { 'Idempotency-Key': key }, data: { scope: 'category', area: 'search' } })
      expect(replay.status()).toBe(200)
      expect((await replay.json()).runId).toBe(failure.runId)
      expect((await home(page.request, siteId)).flags.some(flag => flag.checkId === 'title-missing')).toBe(true)
      await control(page.request, { missingTitle: false })
      await run(page.request, siteId, 'runs', { scope: 'category', area: 'search' }, `category-repair:${required('RELEASE_RUN_ID')}`)
      const repaired = await home(page.request, siteId)
      expect(repaired.audit.id).toBe(source.audit.id)
      expect(repaired.flags.some(flag => flag.checkId === 'title-missing')).toBe(false)
      expect(repaired.resolvedFlags.some(flag => flag.checkId === 'title-missing')).toBe(true)
    } finally { await control(page.request, { missingTitle: false }) }
  })

  test('[journey:automatic-account-lifecycle] real email verification, identity reuse and cleanup after opt-out', async ({ page }) => {
    test.setTimeout(900_000)
    const siteId = required('E2E_CAPABILITY_SITE_ID')
    await control(page.request, { sessionTtlSeconds: 60 })
    try {
      const saved = await page.request.patch(`/api/sites/${siteId}/settings`, { data: { accountChecksEnabled: true } })
      expect(saved.status()).toBe(200)
      const key = `account-lifecycle:${required('RELEASE_RUN_ID')}`
      const admitted = await run(page.request, siteId, 'account-checks', { action: 'retest' }, key)
      const first = accounts(await home(page.request, siteId))
      expect(first.accounts.filter(account => account.purpose === 'retained')).toEqual([expect.objectContaining({ state: 'ACTIVE' })])
      expect(first.accounts.filter(account => account.purpose === 'disposable')).toEqual([expect.objectContaining({ state: 'DELETED' })])
      for (const kind of ['signup', 'verification', 'signed_in', 'deletion'])
        expect(first.results).toContainEqual(expect.objectContaining({ kind, state: 'verified' }))
      const replay = await page.request.post(`/api/sites/${siteId}/account-checks`, { headers: { 'Idempotency-Key': key }, data: { action: 'retest' } })
      expect(replay.status()).toBe(200)
      expect((await replay.json()).runId).toBe(admitted.runId)
      const retainedEmail = first.accounts.find(account => account.purpose === 'retained')!.email
      const targetSessions = async () => {
        const response = await page.request.get(required('E2E_DEPLOYMENT_TRIGGER_URL'), {
          headers: { authorization: `Bearer ${required('E2E_DEPLOYMENT_TRIGGER_TOKEN')}` },
        })
        expect(response.status()).toBe(200)
        const body = await response.json() as { sessions: Array<{ email: string; expiresAt: string; expired: boolean; deleted: boolean }> }
        return body.sessions.filter(session => session.email === retainedEmail)
      }
      const beforeExpiry = await targetSessions()
      expect(beforeExpiry.length).toBeGreaterThan(0)
      expect(beforeExpiry.every(session => !session.deleted)).toBe(true)
      await expect.poll(async () => {
        const sessions = await targetSessions()
        return sessions.length > 0 && sessions.every(session => session.expired && !session.deleted)
      }, { timeout: 120_000, intervals: [2000] }).toBe(true)
      const expired = await targetSessions()
      await run(page.request, siteId, 'account-checks', { action: 'retest' }, `account-reuse:${required('RELEASE_RUN_ID')}`)
      expect(accounts(await home(page.request, siteId)).accounts.find(account => account.purpose === 'retained')?.email)
        .toBe(retainedEmail)
      const renewed = await targetSessions()
      expect(Math.max(...renewed.map(session => new Date(session.expiresAt).getTime())))
        .toBeGreaterThan(Math.max(...expired.map(session => new Date(session.expiresAt).getTime())))
      await test.info().attach('natural-retained-session-expiry', { contentType: 'application/json',
        body: Buffer.from(JSON.stringify({ targetSessionLifetimeSeconds: 60, beforeExpiry, expired, renewed,
          timestampMutation: false, scope: 'Natural controlled-target session expiry followed by normal retained-account reauthentication.' })) })
      expect((await page.request.patch(`/api/sites/${siteId}/settings`, { data: { accountChecksEnabled: false } })).status()).toBe(200)
      expect(accounts(await home(page.request, siteId)).canCleanup).toBe(true)
      expect((await page.request.post(`/api/sites/${siteId}/account-checks`, { headers: { 'Idempotency-Key': 'refused-retest' }, data: { action: 'retest' } })).status()).toBe(409)
      await run(page.request, siteId, 'account-checks', { action: 'cleanup' }, `account-cleanup:${required('RELEASE_RUN_ID')}`)
      expect(accounts(await home(page.request, siteId)).accounts.every(account => account.state === 'DELETED')).toBe(true)
    } finally { await control(page.request, { sessionTtlSeconds: 3600 }) }
  })

  test('[journey:uptime-lifecycle] natural probe cadence, confirmed outage and independent recovery', async ({ page }) => {
    test.setTimeout(900_000)
    const siteId = required('E2E_CAPABILITY_SITE_ID')
    const history = async (): Promise<UptimeHistory> => {
      const response = await page.request.get(`/api/sites/${siteId}/uptime`)
      expect(response.status()).toBe(200)
      return response.json()
    }
    await expect.poll(async () => (await history()).state, { timeout: 360_000 }).toBe('online')
    const beganAt = Date.now()
    try {
      await control(page.request, { outage: true })
      await expect.poll(async () => (await history()).state, { timeout: 420_000, intervals: [2000] }).toBe('offline')
      const failed = await history(), incident = failed.incidents.find(item => !item.recoveredAt && !item.supersededAt)
      expect(incident).toBeDefined()
      expect(new Date(incident!.confirmedAt).getTime()).toBeGreaterThan(beganAt)
      expect(failed.probes).toContainEqual(expect.objectContaining({ confirmed: true, result: 'FAILED', statusCode: 503 }))
      await control(page.request, { outage: false })
      await expect.poll(async () => (await history()).state, { timeout: 420_000, intervals: [2000] }).toBe('online')
      const recovered = await history()
      expect(recovered.incidents.find(item => item.id === incident!.id)?.recoveredAt).toEqual(expect.any(String))
      const ordinary = recovered.probes.filter(probe => probe.attempt === 1).map(probe => new Date(probe.scheduledAt).getTime()).sort((a, b) => a - b)
      expect(ordinary.some((time, index) => index > 0 && time - ordinary[index - 1] === 300_000)).toBe(true)
    } finally { await control(page.request, { outage: false }) }
  })

  test('[journey:site-removal] unverified external deletion requires explicit acknowledgement and fences new work', async ({ page }) => {
    test.setTimeout(900_000)
    const siteId = required('E2E_CAPABILITY_SITE_ID')
    expect((await page.request.patch(`/api/sites/${siteId}/settings`, { data: { accountChecksEnabled: true } })).status()).toBe(200)
    await run(page.request, siteId, 'account-checks', { action: 'retest' }, `account-before-removal:${required('RELEASE_RUN_ID')}`)
    try {
      await control(page.request, { deletionUnavailable: true })
      await run(page.request, siteId, 'account-checks', { action: 'cleanup' }, `unresolved-cleanup:${required('RELEASE_RUN_ID')}`)
      const remaining = accounts(await home(page.request, siteId)).accounts.filter(account => account.state !== 'DELETED')
      expect(remaining.length).toBeGreaterThan(0)
      expect((await page.request.delete(`/api/sites/${siteId}`, { data: {} })).status()).toBe(409)
      expect((await page.request.delete(`/api/sites/${siteId}`, { data: { acknowledgeRemainingAccounts: true, remainingAccounts: [] } })).status()).toBe(409)
      await page.goto(`/sites/${siteId}/settings`)
      await page.getByRole('button', { name: 'Remove website', exact: true }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog.getByRole('button', { name: 'Remove website', exact: true })).toBeDisabled()
      for (const account of remaining) await expect(dialog.getByText(account.email, { exact: true })).toBeVisible()
      await dialog.getByLabel(ACCOUNT_CHECK_COPY.removalAcknowledgement).check()
      await dialog.getByRole('button', { name: 'Remove website', exact: true }).click()
      await page.waitForURL(url => url.pathname === '/sites')
      expect((await page.request.get(`/api/sites/${siteId}`)).status()).toBe(404)
      expect((await page.request.post(`/api/sites/${siteId}/runs`, { data: { scope: 'site' } })).status()).toBe(404)
    } finally { await control(page.request, { deletionUnavailable: false }) }
  })
})
