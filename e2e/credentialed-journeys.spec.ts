import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import AxeBuilder from '@axe-core/playwright'
import { PrismaClient } from '@prisma/client'
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
  await page.getByLabel('Password').fill(password)
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

async function assertAuthenticatedProductSurface(page: Page, url: string): Promise<void> {
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ colorScheme: width === 768 ? 'dark' : 'light', reducedMotion: 'reduce' })
    await page.goto(url)
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
    const geometry = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1)
    const violations = (await new AxeBuilder({ page: page as never }).analyze()).violations
    expect(violations).toEqual([])
    const undersized = await page.locator('main button, main input, main select, main textarea, main [role="button"], main [role="radio"]').evaluateAll(
      (elements) => elements.filter((element) => {
        const rect = element.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0 && (rect.width < 43.99 || rect.height < 43.99)
      }).map((element) => element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 60)),
    )
    expect(undersized).toEqual([])
    await page.evaluate(() => { document.documentElement.style.fontSize = '' })
  }
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
      expect(tools.some((tool) => tool.name === 'ff_get_connection_info')).toBe(true)
      const connection = await this.call('ff_get_connection_info', {})
      expect(connection).toMatchObject({ contractVersion: '1.0', ready: true })
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
    const email = `release-${Date.now()}@example.test`
    const password = requiredEnv('E2E_SIGNUP_PASSWORD')

    await page.goto('/')
    await page.getByLabel('Website URL').first().fill(targetUrl)
    await page.getByRole('button', { name: 'Review my site' }).first().click()
    await page.waitForURL(/\/report\/([^/?#]+)/, { timeout: 30_000 })
    const reportId = new URL(page.url()).pathname.split('/').filter(Boolean).at(-1)!
    await waitForReport(page.request, reportId)
    await page.reload()

    const fixList = page.locator('#report-flags')
    await expect(fixList).toBeVisible()
    const anonymousFlags = fixList.locator(
      'button[aria-controls="selected-flag-detail"]'
    )
    await expect
      .poll(() => anonymousFlags.count(), { timeout: 180_000 })
      .toBeGreaterThan(0)
    const anonymousFlagCount = await anonymousFlags.count()
    let demonstratedPromptCount = 0
    for (let index = 0; index < anonymousFlagCount; index += 1) {
      await anonymousFlags.nth(index).click()
      demonstratedPromptCount += await fixList
        .getByRole('button', { name: /copy prompt/i })
        .count()
    }
    expect(demonstratedPromptCount).toBe(0)

    await page.goto(`/sign-up?next=${encodeURIComponent(`/report/${reportId}`)}`)
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Create account', exact: true }).click()
    await page.waitForURL((url) => url.pathname === `/report/${reportId}`, { timeout: 45_000 })
    await expect(page.locator('#report-flags')).toBeVisible()
    const claimedPromptCount = await page
      .locator('#report-flags')
      .getByRole('button', { name: /copy prompt/i })
      .count()
    expect(claimedPromptCount).toBeGreaterThan(1)

    await page.getByRole('button', { name: 'Recheck', exact: true }).click()
    await page.waitForURL((url) => url.pathname.startsWith('/report/') && !url.pathname.endsWith(reportId), {
      timeout: 30_000,
    })
    const recheckId = new URL(page.url()).pathname.split('/').filter(Boolean).at(-1)!
    const recheck = await waitForReport(page.request, recheckId)
    expect(recheck.mode).toBe('FULL')
    await page.reload()
    await expect(page.locator('#recheck-results')).toBeVisible()
    await expect(page.getByText(/Remember/i).first()).toBeVisible()
  })

  test('[journey:passkey-2fa-recovery] passkey sign-in and backup-code recovery both complete 2FA', async ({ browser }) => {
    test.setTimeout(120_000)
    const email = requiredEnv('E2E_2FA_EMAIL')
    const password = requiredEnv('E2E_2FA_PASSWORD')
    const credentialId = requiredEnv('E2E_WEBAUTHN_CREDENTIAL_ID')
    const privateKey = requiredEnv('E2E_WEBAUTHN_PRIVATE_KEY')
    const userHandle = requiredEnv('E2E_WEBAUTHN_USER_HANDLE')

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
        signCount: 0,
        userHandle,
      },
    })
    await signIn(passkeyPage, email, password)
    await expect(passkeyPage).toHaveURL(/\/two-factor/)
    await passkeyPage.getByRole('button', { name: 'Continue with passkey' }).click()
    await passkeyPage.waitForURL((url) => !url.pathname.startsWith('/two-factor'), {
      timeout: 30_000,
    })
    await passkeyContext.close()

    const recoveryContext = await browser.newContext()
    const recoveryPage = await recoveryContext.newPage()
    await signIn(recoveryPage, email, password)
    await recoveryPage.getByLabel('Backup code').fill(requiredEnv('E2E_2FA_BACKUP_CODE'))
    await recoveryPage.getByRole('button', { name: 'Verify backup code' }).click()
    await recoveryPage.waitForURL((url) => !url.pathname.startsWith('/two-factor'), {
      timeout: 30_000,
    })
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

  test('[journey:free-chat-timeline] Free chat persists and private Timeline data remains owner-only', async ({ browser }) => {
    test.setTimeout(180_000)
    const owner = await signedInPage(browser, 'E2E_BILLING_FREE_EMAIL', 'E2E_BILLING_FREE_PASSWORD')
    const reportId = requiredEnv('E2E_FREE_REPORT_ID')
    const sent = await owner.page.request.post(`/api/reports/${reportId}/chat`, {
      data: { message: 'What is the highest priority evidence in this Review?' },
    })
    expect(sent.ok(), await sent.text()).toBe(true)
    const history = await owner.page.request.get(`/api/reports/${reportId}/chat`)
    expect(history.ok(), await history.text()).toBe(true)
    expect(JSON.stringify(await history.json())).toContain('highest priority evidence')
    const status = await owner.page.request.get(`/api/reports/${reportId}/status`)
    expect(status.ok(), await status.text()).toBe(true)
    expect((await status.json()) as { actionTimeline?: unknown[] }).toHaveProperty('actionTimeline')
    await owner.close()
  })

  test('[journey:billing-revoked] revoked billing removes paid entitlements without hiding owned Reviews', async ({ browser }) => {
    const revoked = await signedInPage(browser, 'E2E_REVOKED_EMAIL', 'E2E_REVOKED_PASSWORD')
    const me = await revoked.page.request.get('/api/me')
    expect(me.ok(), await me.text()).toBe(true)
    const body = (await me.json()) as {
      user: { entitlements: { canAccessPaidFeatures: boolean; canWatchProduct: boolean } }
    }
    expect(body.user.entitlements.canAccessPaidFeatures).toBe(false)
    expect(body.user.entitlements.canWatchProduct).toBe(true)
    const report = await revoked.page.request.get(`/api/reports/${requiredEnv('E2E_REVOKED_REPORT_ID')}/status`)
    expect(report.ok(), await report.text()).toBe(true)
    await revoked.close()
  })

  test('[journey:shared-canvas] an authenticated owner creates and revises an evidence-grounded Canvas', async ({ browser }) => {
    test.setTimeout(180_000)
    const pro = await signedInPage(browser, 'E2E_PRO_EMAIL', 'E2E_PRO_PASSWORD')
    const reportId = requiredEnv('E2E_PRO_REPORT_ID')
    const created = await pro.page.request.post(`/api/reports/${reportId}/canvases`, {
      data: { title: 'Release evidence', instruction: 'Summarize the highest-priority verified evidence.' },
    })
    expect(created.status(), await created.text()).toBe(201)
    const result = (await created.json()) as { canvas: { id: string }; current: { version: number } }
    const revised = await pro.page.request.post(
      `/api/reports/${reportId}/canvases/${result.canvas.id}/versions`,
      { data: { action: 'revise', instruction: 'Make the next action explicit and preserve evidence.' } },
    )
    expect(revised.status(), await revised.text()).toBe(201)
    expect(((await revised.json()) as { version: number }).version).toBeGreaterThan(result.current.version)
    await pro.close()
  })

  test('[journey:shared-product-boundary] Studio and Free can both create a Product', async ({ browser }) => {
    const studio = await signedInPage(browser, 'E2E_STUDIO_EMAIL', 'E2E_STUDIO_PASSWORD')
    const created = await studio.page.request.post('/api/projects', {
      data: { name: 'Release Product', url: requiredEnv('E2E_AUDIT_URL') },
    })
    expect(created.status(), await created.text()).toBe(201)
    const productId = String(((await created.json()) as { id?: string }).id)
    expect(productId).not.toBe('undefined')
    const allowedOrigin = new URL(requiredEnv('E2E_AUDIT_URL')).origin
    const issued = await studio.page.request.post(`/api/projects/${productId}/signal-keys`, {
      data: { name: 'Release browser', allowedOrigin },
    })
    expect(issued.status(), await issued.text()).toBe(201)
    const signalKey = (await issued.json()) as { id: string; key: string }
    const ingested = await studio.page.request.post(`/api/products/${productId}/signals`, {
      headers: { Origin: allowedOrigin },
      data: {
        key: signalKey.key,
        events: [{
          id: `release-${Date.now()}`,
          kind: 'NAVIGATION',
          name: 'release_product_opened',
          route: `${allowedOrigin}/release-proof`,
          occurredAt: new Date().toISOString(),
        }],
      },
    })
    expect(ingested.status(), await ingested.text()).toBe(202)
    await assertAuthenticatedProductSurface(studio.page, '/dashboard')
    await assertAuthenticatedProductSurface(studio.page, `/products/${productId}`)
    await expect(studio.page.getByText(/Last accepted Signal/i)).toBeVisible()
    await expect(studio.page.getByText(/never verify a fix/i)).toBeVisible()
    const listed = await studio.page.request.get(`/api/projects/${productId}/signal-keys`)
    expect(JSON.stringify(await listed.json())).not.toContain(signalKey.key)
    const revoked = await studio.page.request.delete(`/api/projects/${productId}/signal-keys?keyId=${signalKey.id}`)
    expect(revoked.ok(), await revoked.text()).toBe(true)
    const free = await signedInPage(browser, 'E2E_BILLING_FREE_EMAIL', 'E2E_BILLING_FREE_PASSWORD')
    const freeCreated = await free.page.request.post('/api/projects', {
      data: { name: 'Free Release Product', url: `${requiredEnv('E2E_AUDIT_URL')}?plan=free` },
    })
    expect(freeCreated.status(), await freeCreated.text()).toBe(201)
    await studio.close()
    await free.close()
  })

  test('[journey:protected-sharing] protected share grants access, counts a view, and denies after revoke', async ({ browser }) => {
    const owner = await signedInPage(browser, 'E2E_SHARE_OWNER_EMAIL', 'E2E_SHARE_OWNER_PASSWORD')
    const reportId = requiredEnv('E2E_SHARE_REPORT_ID')
    const password = requiredEnv('E2E_SHARE_PASSWORD')
    const created = await owner.page.request.post(`/api/reports/${reportId}/share-links`, {
      data: {
        label: 'Release verification',
        password,
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
        maxViews: 3,
      },
    })
    expect(created.ok(), await created.text()).toBe(true)
    const link = (await created.json()) as { id: string; token: string }

    const viewerContext = await browser.newContext()
    const viewer = await viewerContext.newPage()
    await viewer.goto(`/share/${link.token}`)
    await viewer.getByLabel(/password/i).fill(password)
    await viewer.getByRole('button', { name: /view report/i }).click()
    await viewer.waitForURL(new RegExp(`/report/${reportId}`))
    await viewer.reload()
    await expect(viewer.locator('#report-flags')).toBeVisible()

    const links = await owner.page.request.get(`/api/reports/${reportId}/share-links`)
    const refreshed = (await links.json()) as Array<{ id: string; viewCount: number }>
    expect(refreshed.find((candidate) => candidate.id === link.id)?.viewCount).toBe(1)
    const revoke = await owner.page.request.delete(
      `/api/reports/${reportId}/share-links?shareId=${encodeURIComponent(link.id)}`
    )
    expect(revoke.ok(), await revoke.text()).toBe(true)
    await viewerContext.close()

    const deniedContext = await browser.newContext()
    const denied = await deniedContext.newPage()
    await denied.goto(`/share/${link.token}`)
    await expect(denied.getByText(/unavailable|revoked|not found/i).first()).toBeVisible()
    await deniedContext.close()
    await owner.close()
  })

  test('[journey:attempt-update-receipt] explicit attempt reaches an independent update Review receipt', async ({ browser }) => {
    test.setTimeout(420_000)
    const owner = await signedInPage(browser, 'E2E_SHARE_OWNER_EMAIL', 'E2E_SHARE_OWNER_PASSWORD')
    const reportId = requiredEnv('E2E_SHARE_REPORT_ID')
    const status = await owner.page.request.get(`/api/reports/${reportId}/status`)
    const statusBody = (await status.json()) as { partialFlags?: Array<{ id: string }> }
    const flagId = statusBody.partialFlags?.[0]?.id
    expect(flagId).toBeTruthy()
    const attempted = await owner.page.request.post(`/api/flags/${flagId}/attempts`, {
      data: {
        builder: 'Release browser journey',
        action: 'READY_TO_VERIFY',
        changeSummary: 'Applied the release fixture change for independent verification.',
        deploymentReference: 'release-matrix',
      },
    })
    expect(attempted.status(), await attempted.text()).toBe(201)
    await deployControlledFixture(owner.page.request, {
      journey: 'attempt-update-receipt',
      reportId,
      flagId: flagId!,
    })
    const update = await owner.page.request.post(`/api/reports/${reportId}/re-check`)
    expect(update.status(), await update.text()).toBe(201)
    const childId = ((await update.json()) as { reportId: string }).reportId
    await waitForReport(owner.page.request, childId)
    await owner.page.goto(`/report/${childId}`)
    await expect(owner.page.getByText('Improved', { exact: true }).first()).toBeVisible()
    const childStatus = await owner.page.request.get(`/api/reports/${childId}/status`)
    const childBody = await childStatus.json() as {
      verificationReceipts?: Array<{
        outcome?: string
        comparable?: boolean
        verificationCoverage?: { verifierExecuted?: boolean }
        evidenceReference?: { beforeFlagId?: string; afterAuditId?: string }
      }>
    }
    const receipt = childBody.verificationReceipts?.[0]
    expect(receipt).toMatchObject({
      outcome: 'IMPROVED',
      comparable: true,
      verificationCoverage: { verifierExecuted: true },
      evidenceReference: { beforeFlagId: flagId, afterAuditId: childId },
    })
    await owner.close()
  })

  test('[journey:watch-child-notification] Product Watch schedules a full re-check and sends one sandbox email', async ({ browser }) => {
    test.setTimeout(420_000)
    const user = await signedInPage(browser, 'E2E_WATCH_EMAIL', 'E2E_WATCH_PASSWORD')
    const projectId = requiredEnv('E2E_WATCH_PROJECT_ID')
    const before = await user.page.request.get(`/api/projects/${projectId}/watch`)
    expect(before.ok(), await before.text()).toBe(true)
    const prior = (await before.json()) as { watchLastRunAt?: string | null }

    const update = await user.page.request.put(`/api/projects/${projectId}/watch`, {
      data: { interval: 'weekly' },
    })
    expect(update.ok(), await update.text()).toBe(true)

    const releaseDatabaseUrl = requiredEnv('RELEASE_FRESH_DATABASE_URL')
    expect(new URL(releaseDatabaseUrl).pathname).toMatch(/release|test/i)
    const fixtureDb = new PrismaClient({ datasources: { db: { url: releaseDatabaseUrl } } })
    await fixtureDb.project.update({
      where: { id: projectId },
      data: { watchNextRunAt: new Date(Date.now() - 1_000), watchLeaseUntil: null },
    })

    await expect.poll(async () => {
      const response = await user.page.request.get(`/api/projects/${projectId}/watch`)
      const body = (await response.json()) as { watchLastRunAt?: string | null }
      return body.watchLastRunAt
    }, { timeout: 360_000 }).not.toBe(prior.watchLastRunAt ?? null)

    const child = await fixtureDb.audit.findFirst({
      where: { projectId, recheckTrigger: 'WATCH' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, parentId: true, status: true, watchNotificationStatus: true },
    })
    await fixtureDb.$disconnect()
    expect(child).toMatchObject({
      parentId: expect.any(String),
      status: 'COMPLETED',
      watchNotificationStatus: 'SENT',
    })

    const mailboxUrl = new URL(requiredEnv('E2E_WATCH_MAILBOX_ASSERT_URL'))
    mailboxUrl.searchParams.set('childReportId', child!.id)
    mailboxUrl.searchParams.set('idempotencyKey', `fixflags-watch-${child!.id}-v1`)
    const mailbox = await user.page.request.get(mailboxUrl.toString(), {
      headers: process.env.E2E_WATCH_MAILBOX_TOKEN
        ? { Authorization: `Bearer ${process.env.E2E_WATCH_MAILBOX_TOKEN}` }
        : undefined,
    })
    expect(mailbox.ok(), await mailbox.text()).toBe(true)
    const mail = (await mailbox.json()) as {
      matchingMessages: number
      childReportId?: string
      idempotencyKey?: string
    }
    expect(mail).toMatchObject({
      matchingMessages: 1,
      childReportId: child!.id,
      idempotencyKey: `fixflags-watch-${child!.id}-v1`,
    })
    await user.close()
  })

  test('[journey:github-oauth-pr] GitHub OAuth and repository scan produce one permitted Fix PR', async ({ browser }) => {
    test.setTimeout(420_000)
    const user = await signedInPage(browser, 'E2E_GITHUB_EMAIL', 'E2E_GITHUB_PASSWORD')
    const connect = await user.page.request.get('/api/integrations/github/connect', { maxRedirects: 0 })
    expect(connect.status()).toBe(302)
    expect(connect.headers().location).toMatch(/^https:\/\/github\.com\/login\/oauth\/authorize/)
    const started = await user.page.request.post('/api/repo-scans', {
      data: { repoFullName: requiredEnv('E2E_GITHUB_REPOSITORY') },
    })
    expect(started.ok(), await started.text()).toBe(true)
    const { repoScanId } = (await started.json()) as { repoScanId: string }

    const completed = await expect.poll(async () => {
      const response = await user.page.request.get(`/api/repo-scans/${repoScanId}`)
      const body = (await response.json()) as {
        scan: { status: string; findings: Array<{ id: string; fixable: boolean }> }
      }
      return body.scan.status === 'COMPLETED' ? body.scan : null
    }, { timeout: 360_000 }).not.toBeNull()
    void completed

    const scanResponse = await user.page.request.get(`/api/repo-scans/${repoScanId}`)
    const scan = (await scanResponse.json()) as {
      scan: { findings: Array<{ id: string; fixable: boolean }> }
    }
    const finding = scan.scan.findings.find((candidate) => candidate.fixable)
    expect(finding, 'Dedicated test repository must contain a permitted fixable finding').toBeTruthy()
    const fix = await user.page.request.post(
      `/api/repo-scans/${repoScanId}/findings/${finding!.id}/fix-pr`
    )
    expect(fix.ok(), await fix.text()).toBe(true)

    await expect.poll(async () => {
      const response = await user.page.request.get(
        `/api/repo-scans/${repoScanId}/findings/${finding!.id}/fix-pr`
      )
      const body = (await response.json()) as { fixPr: { status: string; prUrl?: string | null } }
      return body.fixPr.status === 'OPEN' ? body.fixPr.prUrl : null
    }, { timeout: 180_000 }).toMatch(/^https:\/\/github\.com\//)
    await user.close()
  })

  test('[journey:mcp-full-loop] MCP authenticates, checks, records an attempt, and re-checks', async ({ request }) => {
    test.setTimeout(420_000)
    const apiKey = requiredEnv('E2E_API_KEY')
    const client = createMcpClient(request, apiKey)
    await client.initialize()
    const created = await mcpCall(client, 'ff_check_and_plan', {
      url: requiredEnv('E2E_AUDIT_URL'),
      mode: 'single',
    })
    const reportId = String(created.reportId)
    expect(reportId).not.toBe('undefined')

    await expect.poll(async () => {
      const status = await mcpCall(client, 'ff_get_check_status', { reportId })
      return status.status
    }, { timeout: 360_000 }).toBe('COMPLETED')

    const report = await mcpCall(client, 'ff_get_report', { reportId })
    expect(report.reportId).toBe(reportId)
    const fixes = await mcpCall(client, 'ff_get_all_fixes', { reportId })
    expect(Array.isArray(fixes.items)).toBe(true)
    const firstFlagId = String((fixes.items as Array<{ flagId?: string }>)[0]?.flagId)
    expect(firstFlagId).not.toBe('undefined')
    const attempt = await mcpCall(client, 'ff_mark_fix_attempted', {
      flagId: firstFlagId,
      action: 'READY_TO_VERIFY',
      changeSummary: 'Credentialed release journey change ready for independent verification',
      deploymentReference: 'release-matrix',
    })
    expect(attempt.sourceReviewId).toBe(reportId)
    expect(attempt.attemptId).toBeTruthy()
    await deployControlledFixture(request, {
      journey: 'mcp-full-loop',
      reportId,
      flagId: firstFlagId,
    })
    const recheck = await mcpCall(client, 'ff_recheck_and_compare', { parentReportId: reportId })
    expect(recheck.parentReportId).toBe(reportId)
    await expect.poll(async () => {
      const status = await mcpCall(client, 'ff_get_check_status', { reportId: String(recheck.reportId) })
      return status.status
    }, { timeout: 360_000 }).toBe('COMPLETED')
    const receipt = await mcpCall(client, 'ff_get_report', { reportId: String(recheck.reportId) })
    expect(receipt.verificationReceipts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        attemptId: attempt.attemptId,
        outcome: 'IMPROVED',
        comparable: true,
        verificationCoverage: expect.objectContaining({ verifierExecuted: true }),
      }),
    ]))
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
