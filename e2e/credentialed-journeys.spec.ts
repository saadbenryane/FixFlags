import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { expect, type Browser, type Page, type APIRequestContext, test } from '@playwright/test'

const execFileAsync = promisify(execFile)
const baseURL = (process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3107').replace(/\/$/, '')
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

async function mcpCall(
  request: APIRequestContext,
  apiKey: string,
  name: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const response = await request.post(process.env.E2E_MCP_URL ?? `${baseURL}/api/mcp`, {
    headers: { 'x-api-key': apiKey, Accept: 'application/json' },
    data: {
      jsonrpc: '2.0',
      id: `${name}-${Date.now()}`,
      method: 'tools/call',
      params: { name, arguments: args },
    },
  })
  expect(response.ok(), await response.text()).toBe(true)
  const rpc = (await response.json()) as {
    error?: { message?: string }
    result?: { content?: Array<{ type?: string; text?: string }> }
  }
  expect(rpc.error, rpc.error?.message).toBeUndefined()
  const text = rpc.result?.content?.find((item) => item.type === 'text')?.text
  expect(text).toBeTruthy()
  return JSON.parse(text!) as Record<string, unknown>
}

test.describe('credentialed revenue journeys', () => {
  test.beforeEach(() => {
    test.skip(
      !credentialedEnabled,
      'Set E2E_CREDENTIALED=true with a disposable release database and reset consent'
    )
  })

  test('anonymous claim unlocks prompts and produces a free full re-check diff', async ({ page }) => {
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
    expect(demonstratedPromptCount).toBe(1)

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

    await page.getByRole('button', { name: 'Re-check', exact: true }).click()
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

  test('passkey sign-in and backup-code recovery both complete 2FA', async ({ browser }) => {
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

  test('Stripe checkout and portal sessions are created for sandbox fixtures', async ({ browser }) => {
    const free = await signedInPage(browser, 'E2E_BILLING_FREE_EMAIL', 'E2E_BILLING_FREE_PASSWORD')
    const checkout = await free.page.request.post('/api/stripe/checkout', { data: { plan: 'BUILDER' } })
    expect(checkout.ok(), await checkout.text()).toBe(true)
    expect(((await checkout.json()) as { url: string }).url).toMatch(/^https:\/\/checkout\.stripe\.com\//)
    await free.close()

    const paid = await signedInPage(browser, 'E2E_BILLING_PAID_EMAIL', 'E2E_BILLING_PAID_PASSWORD')
    const portal = await paid.page.request.post('/api/stripe/portal')
    expect(portal.ok(), await portal.text()).toBe(true)
    expect(((await portal.json()) as { url: string }).url).toMatch(/^https:\/\/billing\.stripe\.com\//)
    await paid.close()
  })

  test('protected share grants access, counts a view, and denies after revoke', async ({ browser }) => {
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

  test('Product Watch schedules a full re-check and sends one sandbox email', async ({ browser }) => {
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

    await expect.poll(async () => {
      const response = await user.page.request.get(`/api/projects/${projectId}/watch`)
      const body = (await response.json()) as { watchLastRunAt?: string | null }
      return body.watchLastRunAt
    }, { timeout: 360_000 }).not.toBe(prior.watchLastRunAt ?? null)

    const mailbox = await user.page.request.get(requiredEnv('E2E_WATCH_MAILBOX_ASSERT_URL'), {
      headers: process.env.E2E_WATCH_MAILBOX_TOKEN
        ? { Authorization: `Bearer ${process.env.E2E_WATCH_MAILBOX_TOKEN}` }
        : undefined,
    })
    expect(mailbox.ok(), await mailbox.text()).toBe(true)
    expect(((await mailbox.json()) as { matchingMessages: number }).matchingMessages).toBe(1)
    await user.close()
  })

  test('GitHub repository scan produces one permitted Fix PR', async ({ browser }) => {
    test.setTimeout(420_000)
    const user = await signedInPage(browser, 'E2E_GITHUB_EMAIL', 'E2E_GITHUB_PASSWORD')
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

  test('MCP authenticates, checks, polls, returns fixes, and re-checks', async ({ request }) => {
    test.setTimeout(420_000)
    const apiKey = requiredEnv('E2E_API_KEY')
    const created = await mcpCall(request, apiKey, 'ff_check_and_plan', {
      url: requiredEnv('E2E_AUDIT_URL'),
      mode: 'single',
    })
    const reportId = String(created.reportId)
    expect(reportId).not.toBe('undefined')

    await expect.poll(async () => {
      const status = await mcpCall(request, apiKey, 'ff_get_check_status', { reportId })
      return status.status
    }, { timeout: 360_000 }).toBe('COMPLETED')

    const report = await mcpCall(request, apiKey, 'ff_get_report', { reportId })
    expect(report.reportId).toBe(reportId)
    const fixes = await mcpCall(request, apiKey, 'ff_get_all_fixes', { reportId })
    expect(Array.isArray(fixes.items)).toBe(true)
    const firstFlagId = String((fixes.items as Array<{ id?: string }>)[0]?.id)
    expect(firstFlagId).not.toBe('undefined')
    const attempt = await mcpCall(request, apiKey, 'ff_mark_fix_attempted', {
      flagId: firstFlagId,
      action: 'READY_TO_VERIFY',
      changeSummary: 'Credentialed release journey change ready for independent verification',
      deploymentReference: 'release-matrix',
    })
    expect(attempt.sourceReviewId).toBe(reportId)
    expect(attempt.attemptId).toBeTruthy()
    const recheck = await mcpCall(request, apiKey, 'ff_recheck_and_compare', { reportId })
    expect(recheck.parentReportId).toBe(reportId)
  })

  test('packaged CLI checks, returns its Fix List, and re-checks the release app', async () => {
    test.setTimeout(420_000)
    const env = {
      ...process.env,
      FIXFLAGS_API_URL: baseURL,
      FIXFLAGS_API_KEY: requiredEnv('E2E_API_KEY'),
    }
    const checked = await execFileAsync(
      'node',
      ['fixflags-cli/bin/fixflags.js', 'check', requiredEnv('E2E_AUDIT_URL'), '--single', '--json'],
      { cwd: process.cwd(), env, timeout: 360_000 }
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
        'fixflags-cli/bin/fixflags.js',
        'attempt',
        flagId!,
        '--summary',
        'Credentialed CLI change ready for independent verification',
        '--deployment',
        'release-matrix',
        '--json',
      ],
      { cwd: process.cwd(), env, timeout: 60_000 }
    )
    const attempt = JSON.parse(attempted.stdout) as {
      attemptId: string
      sourceReviewId: string
    }
    expect(attempt.attemptId).toBeTruthy()
    expect(attempt.sourceReviewId).toBe(result.reportId)

    const rechecked = await execFileAsync(
      'node',
      ['fixflags-cli/bin/fixflags.js', 'recheck', result.reportId, '--json'],
      { cwd: process.cwd(), env, timeout: 360_000 }
    ).catch((error: NodeJS.ErrnoException & { stdout?: string }) => {
      if (error.stdout) return { stdout: error.stdout, stderr: '' }
      throw error
    })
    const diff = JSON.parse(rechecked.stdout) as { parentReportId: string; reportId: string }
    expect(diff.parentReportId).toBe(result.reportId)
    expect(diff.reportId).not.toBe(result.reportId)
  })
})
