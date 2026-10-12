import { expect, test } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { hashPassword } from 'better-auth/crypto'
import { randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { loadEnvConfig } from '@next/env'
import type { SiteHomeView } from '../lib/sites/application/queries'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { MCP_TOOLS } from '../lib/mcp/tool-manifest'
import { z } from 'zod'
import { SITE_BOARD_COPY } from '../lib/marketing/copy/terminology'

test('owned URL entry, partial scan, precise category recheck and responsive evidence', async ({ page, baseURL }) => {
  test.skip(process.env.FIXFLAGS_LOCAL_RELIABILITY_PROOF !== '1' || process.env.FIXFLAGS_LOCAL_PROVIDER_REFUSAL !== '1', 'Explicit isolated local proof only')
  test.setTimeout(240_000)
  loadEnvConfig(process.cwd())
  if (!baseURL || !['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname)) throw new Error('Local app required')
  if (!/^\/fixflags_category_journey_[a-f0-9]+$/.test(new URL(process.env.DATABASE_URL!).pathname)) throw new Error('Disposable category database required')
  const runtime = JSON.parse(await readFile('.cache/customer-reliability-runtime.json', 'utf8'))
  const db = new PrismaClient(), nonce = randomBytes(8).toString('hex')
  const email = `reliability-${nonce}@example.invalid`, password = `Ff!${randomBytes(18).toString('base64url')}`
  const user = await db.user.create({ data: { email, name: 'Category recheck fixture', emailVerified: true, auditsLimit: 100 } })
  await db.account.create({ data: { userId: user.id, accountId: user.id, providerId: 'credential', password: await hashPassword(password) } })
  const output = `.agents/artifacts/scan-completion/category-journey-${nonce}`
  await mkdir(output, { recursive: true })
  const proof: Record<string, unknown> = { environment: 'Local production app, migrated PostgreSQL, isolated Redis, real worker and Chromium. Controlled website and private S3 protocol transport; terminal provider refusal. No external-provider or natural-schedule acceptance.' }
  async function executionMeasurements(auditId: string) {
    const audit = await db.audit.findUniqueOrThrow({ where: { id: auditId }, select: { createdAt: true, startedAt: true, completedAt: true } })
    const firstEvidence = await db.auditPipelineEvent.findFirst({ where: { auditId, event: 'task_observation_committed' },
      orderBy: { occurredAt: 'asc' }, select: { occurredAt: true } })
    const tasks = await db.auditVerifierExecution.findMany({ where: { auditId, workKind: { not: null } },
      select: { targetKey: true, workKind: true, workAttempts: true } })
    return { auditId, admittedAt: audit.createdAt.toISOString(), startedAt: audit.startedAt?.toISOString(),
      queueWaitMs: audit.startedAt ? audit.startedAt.getTime() - audit.createdAt.getTime() : null,
      firstCommittedEvidenceMs: firstEvidence ? firstEvidence.occurredAt.getTime() - audit.createdAt.getTime() : null,
      settlementMs: audit.completedAt ? audit.completedAt.getTime() - audit.createdAt.getTime() : null,
      taskCounts: Object.fromEntries([...new Set(tasks.map(task => task.workKind))].map(kind => [kind, tasks.filter(task => task.workKind === kind).length])),
      taskAttempts: tasks.map(task => ({ identity: task.targetKey, attempts: task.workAttempts })),
      limitation: 'One local journey at configured capacity. Task identities and attempts do not measure duplicate network collection, peak resource use or overload.' }
  }
  try {
    const control = await page.request.post(`${runtime.fixtureOrigin}/control`, { headers: { Authorization: `Bearer ${runtime.token}` }, data: { fixtureEnabled: true, missingTitle: true, broken: false } })
    expect(control.ok()).toBe(true)
    expect((await page.request.post('/api/auth/sign-in/email', { headers: { Origin: baseURL }, data: { email, password } })).ok()).toBe(true)
    await page.goto('/dashboard')
    const consent = page.getByRole('button', { name: 'Only necessary', exact: true })
    if (await consent.isVisible()) await consent.click()
    await page.getByRole('textbox', { name: 'Website URL' }).first().fill(`https://example.com${runtime.prefix}`)
    await page.getByRole('button', { name: 'Analyze', exact: true }).first().click()
    await page.waitForURL(/\/sites\//)
    const siteId = new URL(page.url()).pathname.split('/').filter(Boolean).at(-1)!
    let home: SiteHomeView
    await expect.poll(async () => {
      const response = await page.request.get(`/api/sites/${siteId}`)
      if (!response.ok()) return response.status()
      home = await response.json()
      return home.audit.status
    }, { timeout: 150_000, intervals: [1000] }).toBe('COMPLETED')
    const fullAuditId = home!.audit.id
    expect(home!.captures?.some(capture => capture.device === 'desktop')).toBe(true)
    expect(home!.presentation.result.state).not.toBe('clear')
    proof.source = { siteId, auditId: fullAuditId, result: home!.presentation.result, coverage: home!.presentation.coverage }
    await page.reload()
    const search = page.getByRole('article', { name: 'Search', exact: true })
    await expect(search).toBeVisible()
    await expect(search.getByRole('button', { name: 'Check Search again' })).toBeVisible()
    const submitted = page.waitForRequest(request => request.url().endsWith(`/api/sites/${siteId}/runs`) && request.method() === 'POST')
    const accepted = page.waitForResponse(response => response.url().endsWith(`/api/sites/${siteId}/runs`) && response.request().method() === 'POST')
    await search.getByRole('button', { name: 'Check Search again' }).click()
    expect((await submitted).postDataJSON()).toEqual({ scope: 'category', area: 'search' })
    const response = await accepted
    expect([200, 202], await response.text()).toContain(response.status())
    const admitted = await response.json()
    const category = await db.runRequest.findUniqueOrThrow({ where: { id: admitted.runId } })
    await expect.poll(async () => (await db.runRequest.findUnique({ where: { id: category.id } }))?.status, { timeout: 60_000, intervals: [500] }).toBe('COMPLETED')
    const categoryRun = await (await page.request.get(`/api/sites/${siteId}/runs/${category.id}`)).json()
    expect(categoryRun).toMatchObject({ scope: 'CATEGORY', area: 'search', status: 'COMPLETED' })
    const after = await (await page.request.get(`/api/sites/${siteId}`)).json()
    expect(after.audit.id).toBe(fullAuditId)
    expect(after.flags.some((flag: { checkId: string }) => flag.checkId === 'title-missing')).toBe(true)
    const checkResponse = await page.request.get(`/api/sites/${siteId}/check-results`)
    expect(checkResponse.status()).toBe(200)
    const checks = await checkResponse.json()
    expect(checks.results.some((result: { area: string; auditId: string; historical: boolean }) =>
      result.area === 'search' && result.auditId === category.auditId && !result.historical)).toBe(true)
    expect(checks.results.some((result: { area: string; auditId: string; historical: boolean }) =>
      result.area === 'search' && result.auditId === fullAuditId && !result.historical)).toBe(false)
    proof.depth = { currentSearchAuditId: category.auditId, originalFullSiteAuditId: fullAuditId, httpAgreesWithBoard: true }
    proof.recheck = { runId: category.id, auditId: category.auditId, result: categoryRun.result, coverage: categoryRun.coverage }
    proof.measurements = { fullSite: await executionMeasurements(fullAuditId!), category: await executionMeasurements(category.auditId!) }
    const keyResponse = await page.request.post('/api/api-keys', { data: { name: 'Disposable category client', scopePreset: 'run_checks', expiresInDays: 30 } })
    expect(keyResponse.status()).toBe(201)
    const key = await keyResponse.json()
    const client = new Client({ name: 'fixflags-category-acceptance', version: '1.0.0' })
    try {
      await client.connect(new StreamableHTTPClientTransport(new URL('/api/mcp', baseURL), { requestInit: { headers: { Authorization: `Bearer ${key.key}` } } }))
      const tools = await client.listTools()
      expect(tools.tools.find(tool => tool.name === MCP_TOOLS.run.name)?.inputSchema).toMatchObject({ properties: { scope: expect.any(Object), area: expect.any(Object) } })
      const read = await client.callTool({ name: MCP_TOOLS.getRun.name, arguments: { runId: category.id } })
      expect(read.isError).not.toBe(true)
      expect(read.structuredContent).toMatchObject({ scope: 'CATEGORY', area: 'search', result: categoryRun.result })
      const detail = await client.callTool({ name: MCP_TOOLS.listOutcomes.name, arguments: { siteId } })
      expect(detail.isError).not.toBe(true)
      const detailPayload = detail.structuredContent as { checkResults: Array<{ area: string; auditId: string; historical: boolean }> }
      expect(detailPayload.checkResults.some(result => result.area === 'search' && result.auditId === category.auditId && !result.historical)).toBe(true)
      const started = await client.callTool({ name: MCP_TOOLS.run.name, arguments: { siteId, scope: 'category', area: 'search', idempotencyKey: `mcp-category:${nonce}` } })
      expect(started.isError).not.toBe(true)
      const mcpRunId = z.object({ runId: z.string().min(1) }).parse(started.structuredContent).runId
      await expect.poll(async () => (await db.runRequest.findUnique({ where: { id: mcpRunId } }))?.status, { timeout: 60_000, intervals: [500] }).toBe('COMPLETED')
      const settled = await client.callTool({ name: MCP_TOOLS.getRun.name, arguments: { runId: mcpRunId } })
      expect(settled.isError).not.toBe(true)
      expect(settled.structuredContent).toMatchObject({ scope: 'CATEGORY', area: 'search', result: categoryRun.result })
      proof.mcp = { client: 'official SDK Streamable HTTP client', runId: mcpRunId, scope: 'CATEGORY', area: 'search', agreesWithHttp: true }
    } finally { await client.close() }
    await page.reload()
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => localStorage.setItem('theme', theme), theme)
      await page.reload()
      if (theme === 'dark') await expect(page.locator('html')).toHaveClass(/dark/)
      else await expect(page.locator('html')).not.toHaveClass(/dark/)
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        await page.evaluate(() => { window.scrollTo(0, 0); (document.activeElement as HTMLElement | null)?.blur() })
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
        await expect(page.getByRole('article', { name: 'Search', exact: true })).toBeVisible()
        await expect(page.getByRole('button', { name: 'Check again', exact: true }).first()).toBeEnabled()
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        await page.screenshot({ path: `${output}/${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
      }
    }
    proof.rendered = { widths: [320, 390, 768, 1440], themes: ['light', 'dark'], overflow: false }
    const titleFlag = after.flags.find((flag: { checkId: string }) => flag.checkId === 'title-missing')
    expect(titleFlag).toBeTruthy()
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseURL })
    await page.goto(`/sites/${siteId}/flags/${titleFlag.id}`)
    await expect(page.getByRole('heading', { name: titleFlag.problem, exact: true })).toBeVisible()
    await page.getByRole('button', { name: SITE_BOARD_COPY.copyPrompt, exact: true }).click()
    await expect(page.getByRole('button', { name: SITE_BOARD_COPY.copyPromptCopied, exact: true })).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/title/i)
    expect(await db.improvementAttempt.count({ where: { improvementId: titleFlag.id } })).toBe(0)
    expect((await page.request.post(`${runtime.fixtureOrigin}/control`, { headers: { Authorization: `Bearer ${runtime.token}` },
      data: { missingTitle: false } })).ok()).toBe(true)
    await page.getByRole('button', { name: SITE_BOARD_COPY.verifyFix, exact: true }).click()
    await page.getByLabel(SITE_BOARD_COPY.changeLabel).fill('Restored the original and rendered page title.')
    const verifyResponse = page.waitForResponse(response => response.url().endsWith(`/api/sites/${siteId}/flags/${titleFlag.id}/verify`) && response.request().method() === 'POST')
    await page.getByRole('dialog').getByRole('button', { name: SITE_BOARD_COPY.verifyFix, exact: true }).click()
    const acceptedVerification = await verifyResponse
    expect(acceptedVerification.status()).toBe(202)
    const verified = await acceptedVerification.json()
    await expect.poll(async () => {
      const attempt = await db.improvementAttempt.findUnique({ where: { id: verified.attemptId }, select: { outcome: true, verificationReason: true, comparable: true } })
      proof.repair = { flagId: titleFlag.id, attemptId: verified.attemptId, verificationAuditId: verified.verificationAuditId,
        runId: verified.runRequestId, recordedOutcome: attempt?.outcome, reason: attempt?.verificationReason, comparable: attempt?.comparable }
      return attempt?.outcome
    },
      { timeout: 60_000, intervals: [500] }).toBe('IMPROVED')
    const repairRun = await (await page.request.get(`/api/sites/${siteId}/runs/${verified.runRequestId}`)).json()
    expect(repairRun).toMatchObject({ scope: 'DIAGNOSTIC', result: 'CLEAR', completionState: 'FULL' })
    await page.reload()
    await expect(page.getByRole('heading', { name: SITE_BOARD_COPY.flagRecovered, exact: true })).toBeVisible()
    await page.screenshot({ path: `${output}/flag-recovered-dark-1440.png`, fullPage: true, animations: 'disabled' })
    expect(await db.improvementAttempt.count({ where: { improvementId: titleFlag.id } })).toBe(1)
    proof.repair = { flagId: titleFlag.id, attemptId: verified.attemptId, verificationAuditId: verified.verificationAuditId,
      runId: verified.runRequestId, result: repairRun.result, copiedGuidanceCreatedNoRepair: true, declaredRepairWasIndependentlyVerified: true }
  } finally {
    await writeFile(`${output}/proof.json`, JSON.stringify(proof, null, 2))
    // The orchestration harness removes only this disposable database after its worker closes.
    await db.$disconnect()
  }
})
