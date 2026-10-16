import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { PrismaClient } from '@prisma/client'
import type { SiteHomeView } from '@/lib/sites/site-home'
import { OPEN_BETA_ACCESS } from '@/lib/billing/beta-policy'
import { NOTIFICATION_EMAIL_COPY } from '@/lib/marketing/copy/notification-emails'
import { readOutcomeIncident } from '@/lib/sites/domain/outcome-incident'
import { expect, type Browser, type Page, type APIRequestContext, test } from '@playwright/test'

const execFileAsync = promisify(execFile)
const baseURL = (
  process.env.E2E_CREDENTIALED === 'true'
    ? requiredEnv('E2E_BASE_URL')
    : process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3107'
).replace(/\/$/, '')
const credentialedEnabled =
  process.env.E2E_CREDENTIALED === 'true' &&
  Boolean(process.env.RELEASE_FRESH_DATABASE_URL) &&
  process.env.RELEASE_ALLOW_DATABASE_RESET === 'true'

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} is required when E2E_CREDENTIALED=true`)
  }
  return value
}

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/sign-in')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
}

async function signedInPage(
  browser: Browser,
  emailEnv: string,
  passwordEnv: string
): Promise<{ page: Page; close(): Promise<void> }> {
  const context = await browser.newContext()
  const page = await context.newPage()
  await signIn(page, requiredEnv(emailEnv), requiredEnv(passwordEnv))
  await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'), { timeout: 30_000 })
  return { page, close: () => context.close() }
}

async function waitForReport(
  request: APIRequestContext,
  reportId: string,
  timeoutMs = 240_000
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + timeoutMs
  let last: Record<string, unknown> = {}
  while (Date.now() < deadline) {
    const response = await request.get(`/api/reports/${reportId}/status`)
    expect(response.ok(), await response.text()).toBe(true)
    last = (await response.json()) as Record<string, unknown>
    if (last.status === 'COMPLETED') return last
    if (last.status === 'FAILED') {
      throw new Error(`Report ${reportId} failed: ${String(last.failureCode ?? last.errorMsg)}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000))
  }
  throw new Error(`Report ${reportId} did not finish within ${timeoutMs}ms`)
}

async function deployControlledFixture(
  request: APIRequestContext,
  input: { journey: string; reportId: string; flagId: string },
): Promise<void> {
  const response = await request.post(requiredEnv('E2E_DEPLOYMENT_TRIGGER_URL'), {
    headers: { authorization: `Bearer ${requiredEnv('E2E_DEPLOYMENT_TRIGGER_TOKEN')}` },
    data: input,
  })
  expect(response.ok(), await response.text()).toBe(true)
}

function createMcpClient(request: APIRequestContext, apiKey: string) {
  const mcpUrl = process.env.E2E_MCP_URL ?? `${baseURL}/api/mcp`
  let sessionId: string | null = null
  let requestId = 0

  async function send(method: string, params?: Record<string, unknown>) {
    requestId += 1
    const response = await request.post(mcpUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json, text/event-stream',
        ...(sessionId ? { 'mcp-session-id': sessionId } : {}),
      },
      data: {
        jsonrpc: '2.0',
        id: requestId,
        method,
        ...(params ? { params } : {}),
      },
    })
    sessionId = response.headers()['mcp-session-id'] ?? sessionId
    expect(response.ok(), await response.text()).toBe(true)
    const rpc = (await response.json()) as {
      error?: { message?: string }
      result?: Record<string, unknown>
    }
    expect(rpc.error, rpc.error?.message).toBeUndefined()
    return rpc.result ?? {}
  }

  return {
    async initialize() {
      const initialized = await send('initialize', {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'fixflags-release-gate', version: '1.0.0' },
      })
      expect(initialized).toHaveProperty('serverInfo')
      await request.post(mcpUrl, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json, text/event-stream',
          ...(sessionId ? { 'mcp-session-id': sessionId } : {}),
        },
        data: { jsonrpc: '2.0', method: 'notifications/initialized' },
      })
      const listed = await send('tools/list', {})
      const tools = (listed.tools ?? []) as Array<{ name?: string }>
      expect(tools.some((tool) => tool.name === 'fixflags.get_connection_info')).toBe(true)
      const connection = await this.call('fixflags.get_connection_info', {})
      expect(connection).toMatchObject({ contractVersion: '3.0', protocolVersion: '2026-07-28', ready: true })
    },
    async call(name: string, args: Record<string, unknown>) {
      const result = await send('tools/call', { name, arguments: args }) as {
        content?: Array<{ type?: string; text?: string }>
      }
      const text = result.content?.find((item) => item.type === 'text')?.text
      expect(text).toBeTruthy()
      return JSON.parse(text!) as Record<string, unknown>
    },
  }
}

async function mcpCall(
  client: ReturnType<typeof createMcpClient>,
  name: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return client.call(name, args)
}

test.describe('credentialed revenue journeys', () => {
  test.beforeEach(() => {
    test.skip(
      !credentialedEnabled,
      'Set E2E_CREDENTIALED=true with a disposable release database and reset consent'
    )
  })

  test('[journey:anonymous-claim] anonymous claim keeps prompts private and produces a metered full update-review diff', async ({ page }) => {
    test.setTimeout(420_000)
    const targetUrl = requiredEnv('E2E_AUDIT_URL')
    const email = `validationalerts+${requiredEnv('RELEASE_RUN_ID').toLowerCase()}-claim@fixflags.com`
    const password = requiredEnv('E2E_SIGNUP_PASSWORD')

    await page.goto('/new')
    await page.getByLabel('Website URL').first().fill(targetUrl)
    await page.getByRole('button', { name: 'Analyze' }).first().click()
    await page.waitForURL(/\/sites\//, { timeout: 30_000 })
    await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible()
    await expect(page.getByText(/Preparing your review/i)).toHaveCount(0)
    const siteId = new URL(page.url()).pathname.split('/').filter(Boolean).at(-1)!
    await expect.poll(async () => {
      const response = await page.request.get(`/api/sites/${siteId}`)
      if (!response.ok()) return null
      const body = (await response.json().catch(() => null)) as {
        audit?: { status?: string; id?: string | null }
      } | null
      return body?.audit?.status
    }, { timeout: 240_000 }).toBe('COMPLETED')
    const board = await page.request.get(`/api/sites/${siteId}`)
    const boardBody = (await board.json()) as { audit?: { id?: string | null } }
    const reportId = boardBody.audit?.id
    expect(reportId).toBeTruthy()
    await waitForReport(page.request, reportId!)

    await page.goto(`/sign-up?next=${encodeURIComponent(`/sites/${siteId}`)}`)
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Create account', exact: true }).click()
    await page.getByRole('button', { name: 'Maybe later', exact: true }).click()
    await page.waitForURL((url) => url.pathname === `/sites/${siteId}`, {
      timeout: 45_000,
    })
    await expect(page.getByRole('heading', { name: /Overview|Site settings|Flags/ })).toBeVisible()
    const claimedResponse = await page.request.get(`/api/sites/${siteId}`)
    expect(claimedResponse.status()).toBe(200)
    const claimed = await claimedResponse.json() as SiteHomeView
    const me = await page.request.get('/api/me')
    expect(me.status()).toBe(200)
    expect(claimed.site.userId).toBe((await me.json()).user.id)
    expect(claimed.audit.id).toBe(reportId)
    expect(new URL(claimed.site.url).origin).toBe(new URL(targetUrl).origin)
    const settings = await page.request.patch(`/api/sites/${siteId}/settings`, {
      data: { accountChecksEnabled: false, notificationLevel: 'OFF', notifyOnRecovery: false },
    })
    expect(settings.status(), await settings.text()).toBe(200)

    const update = await page.request.post(`/api/reports/${reportId}/re-check`)
    expect(update.status(), await update.text()).toBe(201)
    const updateBody = (await update.json()) as { reportId: string; siteId?: string }
    expect(updateBody.siteId).toBeTruthy()
    expect(updateBody.siteId).toBe(claimed.site.projectId)
    await waitForReport(page.request, updateBody.reportId)
    await page.goto(`/sites/${updateBody.siteId}`)
    await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible()
    await expect(page.getByText(/Preparing your review/i)).toHaveCount(0)
  })

  test('[journey:passkey-2fa-recovery] passkey sign-in and backup-code recovery both complete 2FA', async ({ browser }) => {
    test.setTimeout(120_000)
    const email = requiredEnv('E2E_2FA_EMAIL')
    const password = requiredEnv('E2E_2FA_PASSWORD')
    const credentialId = requiredEnv('E2E_WEBAUTHN_CREDENTIAL_ID')
    const privateKey = requiredEnv('E2E_WEBAUTHN_PRIVATE_KEY')
    const userHandle = requiredEnv('E2E_WEBAUTHN_USER_HANDLE')
    const signCount = Number(requiredEnv('E2E_WEBAUTHN_SIGN_COUNT'))
    if (!Number.isInteger(signCount) || signCount < 0 || signCount > 0xffffffff)
      throw new Error('E2E_WEBAUTHN_SIGN_COUNT must be the registered authenticator counter')

    const passkeyContext = await browser.newContext()
    const passkeyPage = await passkeyContext.newPage()
    const cdp = await passkeyContext.newCDPSession(passkeyPage)
    await cdp.send('WebAuthn.enable')
    const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
      },
    })
    await cdp.send('WebAuthn.addCredential', {
      authenticatorId,
      credential: {
        credentialId,
        isResidentCredential: true,
        privateKey,
        rpId: new URL(baseURL).hostname,
        signCount,
        userHandle,
      },
    })
    await signIn(passkeyPage, email, password)
    await passkeyPage.waitForURL(/\/two-factor/, { waitUntil: 'load' })
    await passkeyPage.getByRole('button', { name: 'Continue with passkey' }).click()
    await passkeyPage.waitForURL((url) => !url.pathname.startsWith('/two-factor'), {
      timeout: 30_000,
    })
    const passkeySession = await passkeyPage.request.get('/api/auth/get-session')
    expect(passkeySession.status()).toBe(200)
    expect((await passkeySession.json())?.user).toMatchObject({ email, twoFactorEnabled: true })
    await passkeyContext.close()

    const recoveryContext = await browser.newContext()
    const recoveryPage = await recoveryContext.newPage()
    await signIn(recoveryPage, email, password)
    await recoveryPage.getByLabel('Backup code').fill(requiredEnv('E2E_2FA_BACKUP_CODE'))
    await recoveryPage.getByRole('button', { name: 'Verify backup code' }).click()
    await recoveryPage.waitForURL((url) => !url.pathname.startsWith('/two-factor'), {
      timeout: 30_000,
    })
    const recoverySession = await recoveryPage.request.get('/api/auth/get-session')
    expect(recoverySession.status()).toBe(200)
    expect((await recoverySession.json())?.user).toMatchObject({ email, twoFactorEnabled: true })
    await recoveryContext.close()
  })

  test('[journey:billing-webhook-active] Stripe checkout and portal sessions are created for sandbox fixtures', async ({ browser }) => {
    test.setTimeout(240_000)
    const buyer = await signedInPage(browser, 'E2E_GATE_MEMBER_RELEASED_EMAIL', 'E2E_GATE_MEMBER_RELEASED_PASSWORD')
    const checkout = await buyer.page.request.post('/api/stripe/checkout', { data: { plan: 'BUILDER' } })
    expect(checkout.ok(), await checkout.text()).toBe(true)
    const checkoutUrl = ((await checkout.json()) as { url: string }).url
    expect(checkoutUrl).toMatch(/^https:\/\/checkout\.stripe\.com\//)
    await buyer.page.goto(checkoutUrl)
    await buyer.page.getByLabel(/card number/i).fill('4242424242424242')
    await buyer.page.getByLabel(/expiration/i).fill('1234')
    await buyer.page.getByLabel(/security code|cvc/i).fill('123')
    const name = buyer.page.getByLabel(/name on card/i)
    if (await name.count()) await name.fill('FixFlags Release')
    await buyer.page.getByRole('button', { name: /subscribe|pay/i }).click()
    await buyer.page.waitForURL((url) => url.origin === new URL(baseURL).origin, { timeout: 120_000 })
    await expect.poll(async () => {
      const me = await buyer.page.request.get('/api/me')
      const body = (await me.json()) as {
        user: { plan: string; entitlements: { canAccessPaidFeatures: boolean } }
      }
      return `${body.user.plan}:${body.user.entitlements.canAccessPaidFeatures}`
    }, { timeout: 120_000 }).toBe('BUILDER:true')
    const portal = await buyer.page.request.post('/api/stripe/portal')
    expect(portal.ok(), await portal.text()).toBe(true)
    expect(((await portal.json()) as { url: string }).url).toMatch(/^https:\/\/billing\.stripe\.com\//)
    await buyer.close()
  })

  test('[journey:billing-revoked] canceled subscriptions retain their state and owned evidence under the current access policy', async ({ browser }) => {
    test.setTimeout(90_000)
    const revoked = await signedInPage(browser, 'E2E_REVOKED_EMAIL', 'E2E_REVOKED_PASSWORD')
    const me = await revoked.page.request.get('/api/me')
    expect(me.ok(), await me.text()).toBe(true)
    const body = (await me.json()) as {
      user: { id: string; entitlements: { canAccessPaidFeatures: boolean; canWatchProduct: boolean } }
    }
    const db = new PrismaClient({ datasources: { db: { url: requiredEnv('RELEASE_FRESH_DATABASE_URL') } } })
    try {
      const stored = await db.user.findUniqueOrThrow({ where: { id: body.user.id }, select: { subscriptionStatus: true } })
      expect(stored.subscriptionStatus).toBe('CANCELED')
    } finally { await db.$disconnect() }
    expect(body.user.entitlements.canAccessPaidFeatures).toBe(OPEN_BETA_ACCESS)
    expect(body.user.entitlements.canWatchProduct).toBe(true)
    const report = await revoked.page.request.get(`/api/reports/${requiredEnv('E2E_REVOKED_REPORT_ID')}/status`)
    expect(report.ok(), await report.text()).toBe(true)
    await revoked.close()
  })

  test('[journey:watch-child-notification] a new failure and verified recovery produce one delivered summary', async ({ browser }) => {
    test.setTimeout(600_000)
    const user = await signedInPage(browser, 'E2E_WATCH_EMAIL', 'E2E_WATCH_PASSWORD')
    const projectId = requiredEnv('E2E_WATCH_PROJECT_ID')
    const database = requiredEnv('RELEASE_FRESH_DATABASE_URL')
    expect(new URL(database).pathname).toMatch(/release|test/i)
    const fixtureDb = new PrismaClient({ datasources: { db: { url: database } } })
    const control = async (data: Record<string, boolean>) => {
      const response = await user.page.request.post(requiredEnv('E2E_DEPLOYMENT_TRIGGER_URL'), {
        headers: { authorization: `Bearer ${requiredEnv('E2E_DEPLOYMENT_TRIGGER_TOKEN')}` }, data,
      })
      expect(response.status()).toBe(200)
    }
    type ProviderEmail = { id: string; to: string[]; created_at: string; last_event: string; html?: string; tags?: Array<{ name: string; value: string }> }
    const provider = async <T,>(endpoint: string): Promise<T> => {
      await new Promise(resolve => setTimeout(resolve, 550))
      const response = await fetch(`https://api.resend.com/${endpoint}`, { headers: { authorization: `Bearer ${requiredEnv('E2E_RESEND_API_KEY')}` }, signal: AbortSignal.timeout(15_000) })
      expect(response.status, 'Actual provider receipt request').toBe(200)
      return response.json() as Promise<T>
    }
    const beganAt = new Date()
    try {
      // Recent broad evidence is reused by quick scheduled binding checks.
      // Exercise their actual HTTP conditions instead of expecting a title audit.
      expect((await user.page.request.patch(`/api/sites/${projectId}/settings`, {
        data: { notificationLevel: 'OFF', notifyOnRecovery: false },
      })).status()).toBe(200)
      const target = new URL(requiredEnv('E2E_DEPLOYMENT_TRIGGER_URL')).origin
      const outcomeIds: string[] = []
      for (const pathname of ['/pricing', '/checkout']) {
        const created = await user.page.request.post(`/api/sites/${projectId}/outcomes`, {
          data: { action: 'create', kind: 'AVAILABILITY', targetUrl: target + pathname },
        })
        expect(created.status(), await created.text()).toBe(200)
        const body = await created.json() as { outcome?: { id: string } }
        expect(body.outcome?.id).toBeTruthy()
        outcomeIds.push(body.outcome!.id)
      }
      await control({ brokenPricing: true, broken: false })
      const baselineResponse = await user.page.request.post(`/api/sites/${projectId}/runs`, {
        headers: { 'Idempotency-Key': `notification-baseline:${requiredEnv('RELEASE_RUN_ID')}` },
        data: { outcomeIds },
      })
      expect([200, 202], await baselineResponse.text()).toContain(baselineResponse.status())
      const baseline = await baselineResponse.json() as { runId: string; auditId: string }
      await expect.poll(async () => {
        const response = await user.page.request.get(`/api/sites/${projectId}/runs/${baseline.runId}`)
        expect(response.status()).toBe(200)
        return (await response.json()).status
      }, { timeout: 120_000, intervals: [1000] }).toBe('COMPLETED')
      const baselineAssessments = await fixtureDb.outcomeAssessment.findMany({
        where: { auditId: baseline.auditId, outcomeId: { in: outcomeIds } },
        select: { id: true, outcomeId: true, state: true, evidence: true },
      })
      const originalPricing = baselineAssessments.find(row => row.outcomeId === outcomeIds[0])!
      expect(originalPricing).toMatchObject({ state: 'FLAG' })
      expect(baselineAssessments).toContainEqual(expect.objectContaining({ outcomeId: outcomeIds[1], state: 'CLEAR' }))
      const originalIncident = readOutcomeIncident(originalPricing.evidence)
      expect(originalIncident?.flagIds.length).toBeGreaterThan(0)
      expect((await fixtureDb.audit.findUniqueOrThrow({ where: { id: baseline.auditId } })).watchNotificationProviderId).toBeNull()

      await control({ brokenPricing: false, broken: true })
      const settings = await user.page.request.patch(`/api/sites/${projectId}/settings`, {
        data: { notificationLevel: 'FLAGS', notifyOnRecovery: true },
      })
      expect(settings.status(), await settings.text()).toBe(200)
      expect((await user.page.request.put(`/api/projects/${projectId}/watch`, { data: { interval: 'weekly' } })).status()).toBe(200)
      // This designated release fixture accelerates scheduling. It does not
      // establish a natural production full-check cycle.
      await fixtureDb.project.update({ where: { id: projectId }, data: { watchNextRunAt: new Date(Date.now() - 1000), watchLeaseUntil: null } })
      await expect.poll(async () => fixtureDb.audit.findFirst({
        where: { projectId, recheckTrigger: 'WATCH', createdAt: { gte: beganAt }, status: 'COMPLETED', watchNotificationStatus: 'SENT', watchNotificationProviderId: { not: null } },
        select: { id: true },
      }), { timeout: 420_000, intervals: [1000] }).not.toBeNull()
      const child = await fixtureDb.audit.findFirstOrThrow({ where: { projectId, recheckTrigger: 'WATCH', createdAt: { gte: beganAt } }, orderBy: { createdAt: 'desc' } })
      expect(child).toMatchObject({ parentId: baseline.auditId, status: 'COMPLETED', watchNotificationStatus: 'SENT', watchNotificationProviderId: expect.any(String),
        executionSpec: expect.objectContaining({ scope: 'OUTCOMES', outcomes: expect.arrayContaining(outcomeIds.map(id => expect.objectContaining({ id }))) }) })
      expect(child.watchRegressionCount).toBeGreaterThan(0)
      expect(child.watchRecoveryCount).toBeGreaterThan(0)
      const assessments = await fixtureDb.outcomeAssessment.findMany({
        where: { auditId: child.id, outcomeId: { in: outcomeIds } }, select: { outcomeId: true, state: true, evidence: true },
      })
      const pricing = assessments.find(row => row.outcomeId === outcomeIds[0])!
      const checkout = assessments.find(row => row.outcomeId === outcomeIds[1])!
      expect(pricing).toMatchObject({ state: 'CLEAR' })
      expect(checkout).toMatchObject({ state: 'FLAG' })
      const recovery = readOutcomeIncident(pricing.evidence)!, failure = readOutcomeIncident(checkout.evidence)!
      expect(recovery).toMatchObject({ transition: 'recovery', previousAssessmentId: originalPricing.id,
        recoveredFlagIds: expect.arrayContaining(originalIncident!.flagIds) })
      expect(['failure', 'regression']).toContain(failure?.transition)
      expect(failure?.flagIds.length).toBeGreaterThan(0)
      expect(await fixtureDb.outcomeAssessment.findUnique({ where: { id: originalPricing.id },
        select: { id: true, outcomeId: true, state: true, evidence: true } })).toEqual(originalPricing)
      const providerId = child.watchNotificationProviderId!
      await expect.poll(async () => (await provider<ProviderEmail>(`emails/${providerId}`)).last_event,
        { timeout: 120_000, intervals: [2000] }).toBe('delivered')
      const accepted = await provider<ProviderEmail>(`emails/${providerId}`)
      expect(accepted.to).toContain(requiredEnv('E2E_WATCH_EMAIL'))
      expect(accepted.tags).toContainEqual({ name: 'audit_id', value: child.id })
      expect(accepted.html, 'Actual provider message uses the shared brand').toContain('/icon-192.png')
      expect(accepted.html).toContain(NOTIFICATION_EMAIL_COPY.evidence)
      expect(accepted.html).toContain(NOTIFICATION_EMAIL_COPY.attention)
      expect(accepted.html).toContain(NOTIFICATION_EMAIL_COPY.recovery)
      expect(accepted.html?.match(/<li>/g)?.length ?? 0, 'Every eligible finding and requested verified recovery appears in one message')
        .toBe(child.watchRegressionCount! + child.watchRecoveryCount!)
      const recoverySection = accepted.html!.split(NOTIFICATION_EMAIL_COPY.recovery)[1]?.split('</ul>')[0] ?? ''
      const attentionSection = accepted.html!.split(NOTIFICATION_EMAIL_COPY.attention)[1]?.split('</ul>')[0] ?? ''
      for (const id of recovery.recoveredFlagIds) expect(recoverySection).toContain(`/flags/${encodeURIComponent(id)}?`)
      for (const id of failure.flagIds) expect(attentionSection).toContain(`/flags/${encodeURIComponent(id)}?`)
      const evidenceLinks = [...(accepted.html ?? '').matchAll(/href="([^"]+)"/g)]
        .map(match => new URL(match[1].replaceAll('&amp;', '&')))
        .filter(url => url.pathname.startsWith(`/sites/${projectId}/flags/`))
      expect(evidenceLinks.length, 'Actual notification links return to the same Site').toBeGreaterThan(0)
      for (const url of evidenceLinks) expect(url.origin).toBe(new URL(requiredEnv('RELEASE_ENV_URL')).origin)
      const distinctLinks = [...new Set(evidenceLinks.map(url => url.href))]
      expect(distinctLinks.length, 'Failure and recovery each retain their own evidence link').toBeGreaterThanOrEqual(2)
      const otherOwner = await signedInPage(browser, 'E2E_GATE_NON_MEMBER_EMAIL', 'E2E_GATE_NON_MEMBER_PASSWORD')
      try {
        expect((await otherOwner.page.request.get(`/api/sites/${projectId}/flags`)).status()).toBe(404)
        for (const link of distinctLinks) {
          await user.page.goto(link)
          await expect(user.page.getByRole('heading', { name: 'What FixFlags saw', exact: true })).toBeVisible()
          const url = new URL(link)
          const forbidden = await otherOwner.page.request.post('/api' + url.pathname + '/fix', { data: { action: 'copy' } })
          expect(forbidden.status(), 'An unrelated owner cannot retrieve a private notification fix prompt').toBe(404)
        }
      } finally { await otherOwner.close() }
      const listed = await provider<{ data: ProviderEmail[]; has_more: boolean }>('emails?limit=100')
      expect(!listed.has_more || listed.data.some(email => new Date(email.created_at).getTime() < beganAt.getTime()),
        'Provider list must cover the complete observation window').toBe(true)
      const candidates = listed.data.filter(email => email.to.includes(requiredEnv('E2E_WATCH_EMAIL')) &&
        new Date(email.created_at).getTime() >= beganAt.getTime())
      expect(candidates.length, 'Bounded controlled mailbox inspection').toBeLessThan(20)
      const matches: string[] = []
      for (const candidate of candidates) {
        const email = await provider<ProviderEmail>(`emails/${candidate.id}`)
        if (email.tags?.some(tag => tag.name === 'audit_id' && tag.value === child.id)) matches.push(email.id)
      }
      expect(matches).toEqual([providerId])
      await test.info().attach('independent-notification-receipt', { contentType: 'application/json', body: Buffer.from(JSON.stringify({
        originalAuditId: baseline.auditId, auditId: child.id, providerId, acceptanceRecorded: true, providerDelivery: accepted.last_event,
        regressionCount: child.watchRegressionCount, recoveryCount: child.watchRecoveryCount, executionScope: 'OUTCOMES',
        recoveredOutcomeId: outcomeIds[0], failingOutcomeId: outcomeIds[1], originalAssessmentId: originalPricing.id,
        recoveredFlagIds: recovery.recoveredFlagIds, failingFlagIds: failure.flagIds,
        matchingMessages: matches.length, humanReceiptOrRead: false, naturalProductionCycle: false,
      })) })
    } finally {
      try {
        await user.page.request.patch(`/api/sites/${projectId}/settings`, { data: { notificationLevel: 'OFF', notifyOnRecovery: false } })
        await control({ brokenPricing: false, broken: false })
      } finally { await fixtureDb.$disconnect(); await user.close() }
    }
  })

  test('[journey:mcp-full-loop] MCP authenticates, runs Outcomes, records a fix, and verifies it', async ({ request }) => {
    test.setTimeout(420_000)
    const apiKey = requiredEnv('E2E_API_KEY')
    const client = createMcpClient(request, apiKey)
    await client.initialize()
    const listedSites = await mcpCall(client, 'fixflags.list_sites', {})
    const sites = listedSites.sites as Array<{ siteId: string }>
    const siteId = process.env.E2E_SITE_ID ?? sites[0]?.siteId
    expect(siteId, 'Credentialed release journey requires an owned Site').toBeTruthy()
    const listedOutcomes = await mcpCall(client, 'fixflags.list_outcomes', { siteId })
    const outcomeIds = (listedOutcomes.outcomes as Array<{ outcomeId: string }>).map((outcome) => outcome.outcomeId)
    expect(outcomeIds.length).toBeGreaterThan(0)
    const created = await mcpCall(client, 'fixflags.run', {
      siteId,
      outcomeIds,
      idempotencyKey: `release-matrix:${Date.now()}`,
      deployment: 'release-matrix',
    })
    const runId = String(created.runId)
    expect(runId).not.toBe('undefined')

    const run = await expect.poll(async () => {
      const status = await mcpCall(client, 'fixflags.get_run', { runId })
      return status.status === 'COMPLETED' ? status : null
    }, { timeout: 360_000 }).not.toBeNull()
    void run

    const listedFlags = await mcpCall(client, 'fixflags.list_flags', { siteId })
    const firstFlagId = String((listedFlags.flags as Array<{ flagId?: string }>)[0]?.flagId)
    expect(firstFlagId).not.toBe('undefined')
    const attempt = await mcpCall(client, 'fixflags.record_fix', {
      siteId,
      flagId: firstFlagId,
      idempotencyKey: `release-fix:${runId}:${firstFlagId}`,
      changeSummary: 'Credentialed release journey change ready for independent verification',
      deployment: 'release-matrix',
    })
    expect(attempt.attemptId).toBeTruthy()
    await deployControlledFixture(request, {
      journey: 'mcp-full-loop',
      reportId: runId,
      flagId: firstFlagId,
    })
    const verification = await mcpCall(client, 'fixflags.verify_flag', {
      siteId,
      flagId: firstFlagId,
      attemptId: attempt.attemptId,
      idempotencyKey: `release-verify:${attempt.attemptId}`,
    })
    const verificationRunId = String(verification.runId)
    await expect.poll(async () => {
      const status = await mcpCall(client, 'fixflags.get_run', { runId: verificationRunId })
      return status.status
    }, { timeout: 360_000 }).toBe('COMPLETED')
    const verifiedFlag = await mcpCall(client, 'fixflags.get_flag', { siteId, flagId: firstFlagId })
    expect(verifiedFlag.flag).toMatchObject({ flagId: firstFlagId })
  })

  test('[journey:cli-registry-loop] packaged CLI checks, records an attempt, and re-checks the release app', async () => {
    test.setTimeout(420_000)
    const installDir = await mkdtemp(path.join(tmpdir(), 'fixflags-registry-release-'))
    const env = {
      ...process.env,
      FIXFLAGS_API_URL: baseURL,
      FIXFLAGS_API_KEY: requiredEnv('E2E_API_KEY'),
    }
    await execFileAsync('npm', ['init', '-y'], { cwd: installDir, env, timeout: 60_000 })
    await execFileAsync('npm', ['install', '--ignore-scripts', 'fixflags@1.0.5'], {
      cwd: installDir,
      env,
      timeout: 180_000,
    })
    const cli = path.join(installDir, 'node_modules', 'fixflags', 'bin', 'fixflags.js')
    const checked = await execFileAsync(
      'node',
      [cli, 'check', requiredEnv('E2E_AUDIT_URL'), '--single', '--json'],
      { cwd: installDir, env, timeout: 360_000 }
    ).catch((error: NodeJS.ErrnoException & { stdout?: string }) => {
      if (error.stdout) return { stdout: error.stdout, stderr: '' }
      throw error
    })
    const result = JSON.parse(checked.stdout) as {
      reportId: string
      fixList: { items: Array<{ id?: string }> }
    }
    expect(result.reportId).toBeTruthy()
    expect(Array.isArray(result.fixList.items)).toBe(true)
    const flagId = result.fixList.items[0]?.id
    expect(flagId).toBeTruthy()

    const attempted = await execFileAsync(
      'node',
      [
        cli,
        'attempt',
        flagId!,
        '--summary',
        'Credentialed CLI change ready for independent verification',
        '--deployment',
        'release-matrix',
        '--json',
      ],
      { cwd: installDir, env, timeout: 60_000 }
    )
    const attempt = JSON.parse(attempted.stdout) as {
      attemptId: string
      sourceReviewId: string
    }
    expect(attempt.attemptId).toBeTruthy()
    expect(attempt.sourceReviewId).toBe(result.reportId)

    const rechecked = await execFileAsync(
      'node',
      [cli, 'recheck', result.reportId, '--json'],
      { cwd: installDir, env, timeout: 360_000 }
    ).catch((error: NodeJS.ErrnoException & { stdout?: string }) => {
      if (error.stdout) return { stdout: error.stdout, stderr: '' }
      throw error
    })
    const diff = JSON.parse(rechecked.stdout) as { parentReportId: string; reportId: string }
    expect(diff.parentReportId).toBe(result.reportId)
    expect(diff.reportId).not.toBe(result.reportId)
    await rm(installDir, { recursive: true, force: true })
  })
})
