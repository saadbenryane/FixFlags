import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:http'
import { spawn, type ChildProcess } from 'node:child_process'
import { hashPassword } from 'better-auth/crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { requestSiteRun } from '@/lib/sites/application/run-requests'
import { recordSiteFlagFix } from '@/lib/sites/application/flag-verification'
import { getAuditQueue, getAuditTaskQueue } from '@/lib/queue/client'
import { readWorkerHeartbeat, clearWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'
import { TASK_QUEUES } from '@/lib/audit/progressive/queues'
import { siteFlagPanelSchema } from '@/lib/sites/flag-panel'
import { siteHomeViewSchema } from '@/lib/sites/site-view-contract'
import { chromium, expect as browserExpect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { inspectAccessibilityViolations } from '../../e2e/approved-contrast'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import { SITE_DASHBOARD_COPY } from '@/lib/marketing/copy/site-dashboard'
import { CARE_HOME } from '@/lib/marketing/copy/care-homepage'
import { AUDIT_ERRORS } from '@/lib/marketing/copy/errors'
import { OUTCOME_DETAIL_COPY } from '@/lib/marketing/copy/workspace'
import { outcomeStatusLabel } from '@/lib/sites/outcome-state'
import { AUTH } from '@/lib/marketing/copy/auth'

const browserProof = process.env.COMPILED_BROWSER_REQUIRED === 'true'
const authProof = process.env.COMPILED_AUTH_REQUIRED === 'true'
const webProof = browserProof || process.env.COMPILED_WEB_REQUIRED === 'true'
const run = webProof || process.env.COMPILED_WORKER_REQUIRED === 'true' ? describe : describe.skip
run('compiled production ' + (webProof ? 'web API and worker' : 'worker') + ' against disposable services', () => {
  const userId = 'compiled-worker-' + randomUUID(), projectId = userId + '-site'
  const browserUserId = 'browser-owner-' + randomUUID()
  let worker: ChildProcess | undefined, web: ChildProcess | undefined, output = '', url = '', repaired = false
  let webOrigin = '', sessionCookie = ''
  const password = 'Local-fixture-' + randomUUID()
  const providerRefusal = join(tmpdir(), userId + '-provider-refusal.cjs')
  const server = createServer((_request, response) => {
    response.setHeader('content-type', 'text/html')
    response.end('<!doctype html><html lang="en"><head><title>Compiled worker fixture</title>' +
      '<meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main>' +
      '<h1>Choose an action</h1><button id="action" style="width:64px;height:44px"' +
      (repaired ? ' aria-label="Continue"' : '') + '></button></main></body></html>')
  })
  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED !== 'true' ||
      !['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    if (!existsSync('dist/worker/index.js') || !existsSync('dist/worker/check-parser.js'))
      throw new Error('Run npm run worker:build before compiled runtime verification')
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
    url = 'http://127.0.0.1:' + (server.address() as { port: number }).port + '/'
    vi.stubEnv('DEV_ALLOW_LOCALHOST', 'true')
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test', emailVerified: true, role: 'user' } })
    await prisma.project.create({ data: { id: projectId, userId, name: 'Compiled runtime fixture', url,
      canonicalHost: '127.0.0.1', accountChecksEnabled: false, notificationLevel: 'OFF',
      watchInterval: 'WEEKLY', watchPausedAt: new Date() } })
    // Seed only the admitted URL, without supplying a passing inspection.
    await prisma.audit.create({ data: { projectId, userId, url, status: 'COMPLETED', completedAt: new Date(), reportCompleteness: 'PARTIAL',
      executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: url, environment: 'production', checks: {}, outcomes: [], verificationTarget: null },
      pages: { create: { url, normalizedUrl: url, role: 'primary', position: 0, status: 'COMPLETED' } } } })
    const env = { ...process.env }
    for (const key of Object.keys(env)) if (/SECRET|TOKEN|PASSWORD|API_KEY|ACCESS_KEY|CLIENT_ID/.test(key)) env[key] = ''
    Object.assign(env, { NODE_ENV: 'production', FIXFLAGS_PROCESS_ROLE: 'worker', FIXFLAGS_ALLOW_DEGRADED_LOCAL: 'true',
      NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3000', BETTER_AUTH_URL: 'http://127.0.0.1:3000',
      BETTER_AUTH_SECRET: 'compiled-runtime-local-fixture-secret', TOKEN_ENCRYPTION_KEY: '11'.repeat(32) })
    if (browserProof) {
      // The compiled processes keep their real collectors and classifiers.
      // Only this fixture's provider transport returns an explicit refusal.
      writeFileSync(providerRefusal, `
        const original = globalThis.fetch;
        globalThis.fetch = async (input, options) => {
          const target = new URL(typeof input === 'string' || input instanceof URL ? input.toString() : input.url);
          if (target.hostname === 'www.googleapis.com' && target.pathname === '/pagespeedonline/v5/runPagespeed')
            return new Response('Explicit local provider refusal fixture, not live provider evidence', { status: 403 });
          if (['http:', 'https:'].includes(target.protocol) && !['localhost', '127.0.0.1'].includes(target.hostname))
            throw new Error('External transport is disabled in this local browser fixture');
          return original(input, options);
        };
      `)
      env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ''} --require=${providerRefusal}`.trim()
    }
    worker = spawn(process.execPath, ['dist/worker/index.js'], { env, stdio: ['ignore', 'pipe', 'pipe'] })
    const record = (chunk: Buffer) => { output = (output + chunk.toString()).slice(-24_000) }
    worker.stdout!.on('data', record); worker.stderr!.on('data', record)
    await vi.waitFor(async () => {
      if (worker!.exitCode !== null) throw new Error('Compiled worker exited: ' + output)
      expect(await readWorkerHeartbeat()).toMatchObject({ alive: true, browserOk: true })
    }, { timeout: 30_000, interval: 100 })
    if (webProof) {
      const entry = (process.env.NEXT_DIST_DIR || '.next') + '/standalone/server.js'
      if (!existsSync(entry)) throw new Error('Build the web runtime with the selected NEXT_DIST_DIR first')
      const reservation = createServer()
      await new Promise<void>(resolve => reservation.listen(0, '127.0.0.1', resolve))
      const port = (reservation.address() as { port: number }).port
      await new Promise<void>(resolve => reservation.close(() => resolve()))
      webOrigin = 'http://127.0.0.1:' + port
      await prisma.account.create({ data: { userId, accountId: userId, providerId: 'credential', password: await hashPassword(password) } })
      web = spawn(process.execPath, [entry], { env: { ...env, FIXFLAGS_PROCESS_ROLE: 'web', PORT: String(port), HOSTNAME: '127.0.0.1',
        BETTER_AUTH_URL: webOrigin, NEXT_PUBLIC_APP_URL: webOrigin }, stdio: ['ignore', 'pipe', 'pipe'] })
      web.stdout!.on('data', record); web.stderr!.on('data', record)
      await vi.waitFor(async () => {
        if (web!.exitCode !== null) throw new Error('Compiled web process exited: ' + output)
        const health = await fetch(webOrigin + '/api/health', { signal: AbortSignal.timeout(2000) })
        expect(health.status, output).toBe(200)
        expect(await health.json()).toMatchObject({ database: 'ok', aiConfigured: false, storageConfigured: false })
      }, { timeout: 15_000, interval: 100 })
      const signIn = await fetch(webOrigin + '/api/auth/sign-in/email', { method: 'POST',
        headers: { 'content-type': 'application/json', origin: webOrigin },
        body: JSON.stringify({ email: userId + '@example.test', password }) })
      expect(signIn.status, output).toBe(200)
      sessionCookie = signIn.headers.getSetCookie().map(cookie => cookie.split(';')[0]).join('; ')
      expect(Boolean(sessionCookie)).toBe(true)
      expect(siteHomeViewSchema.parse(await http('/api/sites/' + projectId)).site.siteId).toBe(projectId)
    }
  }, 60_000)
  afterAll(async () => {
    if (web && web.exitCode === null && web.signalCode === null) {
      const stopped = new Promise<void>(resolve => web!.once('exit', () => resolve()))
      web.kill('SIGTERM')
      const timer = setTimeout(() => web!.kill('SIGKILL'), 5000)
      try { await stopped } finally { clearTimeout(timer) }
    }
    if (worker && worker.exitCode === null) {
      const stopped = new Promise<void>(resolve => worker!.once('exit', () => resolve()))
      worker.kill('SIGTERM')
      const timer = setTimeout(() => worker!.kill('SIGKILL'), 15_000)
      try { await stopped } finally { clearTimeout(timer) }
    }
    await clearWorkerHeartbeat()
    for (const queue of [getAuditQueue(), ...Object.keys(TASK_QUEUES).map(resource => getAuditTaskQueue(resource as keyof typeof TASK_QUEUES))]) {
      const client = await queue.client; await queue.close(); client.disconnect()
    }
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()))
    await prisma.user.deleteMany({ where: { id: { in: [userId, browserUserId] } } }); await prisma.$disconnect(); vi.unstubAllEnvs()
    if (browserProof && existsSync(providerRefusal)) unlinkSync(providerRefusal)
    if (worker) expect(worker.exitCode, output).toBe(0)
  }, 25_000)
  async function http(path: string, body?: object, key?: string) {
    const response = await fetch(webOrigin + path, { method: body ? 'POST' : 'GET',
      headers: { cookie: sessionCookie, origin: webOrigin, 'content-type': 'application/json', ...(key ? { 'idempotency-key': key } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15_000) })
    const payload = await response.json()
    expect(response.ok, JSON.stringify(payload) + '\n' + output).toBe(true)
    return payload
  }
  async function complete(auditId: string) {
    expect(auditId).toEqual(expect.any(String))
    await vi.waitFor(async () => {
      if (worker!.exitCode !== null) throw new Error('Compiled worker exited: ' + output)
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } }))
        .toMatchObject({ status: 'COMPLETED', improvementProjectedAt: expect.any(Date) })
    }, { timeout: 40_000, interval: 100 })
  }
  it('collects a native failure and independently verifies repair using the compiled parser and consumers', async () => {
    const source = webProof ? await http('/api/sites/' + projectId + '/runs', { scope: 'category', area: 'accessibility' }, 'compiled-source')
      : await requestSiteRun({ projectId, userId, scope: 'CATEGORY', categoryArea: 'accessibility',
        source: 'WEB', outcomeIds: [], idempotencyKey: 'compiled-source' })
    await complete(source.auditId!)
    expect(await prisma.auditExecutionTask.findFirstOrThrow({ where: { auditId: source.auditId!, workKind: 'browser' } }))
      .toMatchObject({ workState: 'COMPLETED', workResult: { kind: 'browser', data: { metadata: { title: 'Compiled worker fixture' } } } })
    const flag = await prisma.flag.findFirstOrThrow({ where: { auditId: source.auditId!, checkId: 'buttons-no-text' } })
    expect(flag.evidenceTargets).toEqual(expect.arrayContaining([expect.objectContaining({ context: expect.stringContaining('accessibility:axe:desktop:') })]))
    const panel = webProof ? siteFlagPanelSchema.parse(await http('/api/sites/' + projectId + '/flags/' + flag.id)) : null
    if (panel) {
      expect(panel.flag).toMatchObject({ sourceFlagId: flag.id, sourceAuditId: source.auditId })
      expect(panel.flag.id).toBe((await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })).improvementId)
    }
    const fix = webProof ? null : await recordSiteFlagFix({ siteId: projectId, flagId: flag.id, userId, idempotencyKey: 'compiled-fix',
      changeSummary: 'Name the action control' })
    repaired = true
    const verification = webProof ? await http('/api/sites/' + projectId + '/flags/' + panel!.flag.id + '/verify',
      { changeSummary: 'Name the action control' }, 'compiled-verify')
      : await requestSiteRun({ projectId, userId, source: 'WEB', outcomeIds: [], idempotencyKey: 'compiled-verify',
        verificationTarget: { kind: 'DIAGNOSTIC', pageUrl: url, checkId: flag.checkId!, parentAuditId: source.auditId!, attemptId: fix!.attemptId } })
    await complete(webProof ? verification.verificationAuditId : verification.auditId!)
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: fix?.attemptId ?? verification.attemptId } }))
      .toMatchObject({ outcome: 'IMPROVED', comparable: true })
    const resolved = await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })
    expect(resolved).toMatchObject({ status: 'FIXED' })
    if (panel) {
      expect(siteFlagPanelSchema.parse(await http('/api/sites/' + projectId + '/flags/' + panel.flag.id)).flag)
        .toMatchObject({ id: panel.flag.id, sourceFlagId: flag.id, status: resolved.status, verifying: false })
      expect(await http('/api/sites/' + projectId + '/flags/' + panel.flag.id + '/verify',
        { changeSummary: 'Name the action control' }, 'compiled-verify'))
        .toMatchObject({ runId: verification.runId, verificationAuditId: verification.verificationAuditId, attemptId: verification.attemptId })
      expect(await prisma.improvementAttempt.count({ where: { improvementId: panel.flag.id } })).toBe(1)
    }
  }, 90_000)

  it.skipIf(!browserProof)('uses ordinary browser sign-in, native clipboard and visible independent repair with recurrence', async () => {
    repaired = false
    await prisma.user.create({ data: { id: browserUserId, email: browserUserId + '@example.test', emailVerified: true, role: 'user' } })
    await prisma.account.create({ data: { userId: browserUserId, accountId: browserUserId, providerId: 'credential', password: await hashPassword(password) } })
    const directory = 'test-results/browser/site-plan-' + userId
    mkdirSync(directory, { recursive: true })
    const browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ baseURL: webOrigin, permissions: ['clipboard-read', 'clipboard-write'],
      viewport: { width: 1280, height: 900 }, colorScheme: 'light', reducedMotion: 'reduce' })
    await context.route('**/*', route => {
      const target = new URL(route.request().url())
      return ['http:', 'https:'].includes(target.protocol) && !['localhost', '127.0.0.1'].includes(target.hostname)
        ? route.abort('blockedbyclient') : route.continue()
    })
    const page = await context.newPage()
    const runtimeErrors: string[] = []
    page.on('pageerror', error => runtimeErrors.push(error.message))
    const accessibility: Array<{ surface: string; theme: string; width: number; failures: string[]; approvedContrastCount: number }> = []
    const browserHttp = async (path: string, body?: object, key?: string) => {
      const result = await page.evaluate(async ({ path, body, key }) => {
        const response = await fetch(path, { method: body ? 'POST' : 'GET', cache: 'no-store',
          headers: { 'content-type': 'application/json', ...(key ? { 'idempotency-key': key } : {}) },
          ...(body ? { body: JSON.stringify(body) } : {}) })
        return { ok: response.ok, status: response.status, data: await response.json() }
      }, { path, body, key })
      expect(result.ok, JSON.stringify(result.data)).toBe(true)
      return result.data
    }
    await context.tracing.start({ screenshots: true, snapshots: true })
    try {
      await page.goto('/')
      await page.getByRole('textbox', { name: 'Website URL' }).first().fill(url)
      await page.getByRole('button', { name: CARE_HOME.hero.cta, exact: true }).first().click()
      await browserExpect(page.getByText(AUDIT_ERRORS.urlLocalhost, { exact: true })).toBeVisible()
      const consent = page.getByRole('dialog', { name: 'Choose your analytics settings' })
      if (await consent.isVisible()) await consent.getByRole('button', { name: 'Only necessary', exact: true }).click()
      // Production input correctly refuses loopback. Existing explicit local
      // admission supports the fixture without weakening that customer policy.
      const admitted = await browserHttp('/api/checks', { url, source: 'homepage' })
      expect(admitted.siteId).toEqual(expect.any(String))
      const provisionalId = admitted.siteId
      await page.goto('/sites/' + provisionalId)
      const visitor = siteHomeViewSchema.parse(await browserHttp('/api/sites/' + provisionalId))
      expect(visitor.actions.ownership).toBe('provisional')
      const initialAuditId = visitor.audit.id!
      await vi.waitFor(async () => {
        expect(await prisma.audit.findUniqueOrThrow({ where: { id: initialAuditId } })).toMatchObject({ status: 'COMPLETED' })
      }, { timeout: 90_000, interval: 250 })
      const publicResult = siteHomeViewSchema.parse(await browserHttp('/api/sites/' + provisionalId))
      expect(publicResult.flags.every(flag => !flag.fix)).toBe(true)
      await page.goto('/sign-in?next=' + encodeURIComponent('/sites/' + provisionalId))
      await page.getByLabel('Email', { exact: true }).fill(browserUserId + '@example.test')
      await page.getByLabel('Password', { exact: true }).fill(password)
      const signedIn = page.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/sign-in/email' && response.request().method() === 'POST')
      await page.getByRole('button', { name: 'Sign in', exact: true }).click()
      expect((await signedIn).status()).toBe(200)
      await page.waitForURL(location => location.pathname.startsWith('/sites/'), { timeout: 30_000 })
      const claimed = siteHomeViewSchema.parse(await browserHttp('/api/sites/' + provisionalId))
      expect(claimed.actions.ownership).toBe('owner')
      expect(claimed.audit.id).toBe(initialAuditId)
      const claimedProjectId = claimed.site.projectId!
      expect(await prisma.provisionalSite.findUniqueOrThrow({ where: { id: visitor.site.provisionalSiteId! } }))
        .toMatchObject({ claimedProjectId, primaryAuditId: initialAuditId })
      expect(claimedProjectId).not.toBe(projectId)
      expect(claimed.watch.interval).not.toBeNull()
      expect(claimed.uptime?.enabled).toBe(true)
      expect(claimed.cards.find(card => card.id === 'performance')?.state).toBe('unknown')
      const availability = claimed.outcomes.find(outcome => outcome.kind === 'AVAILABILITY' && outcome.bindings.some(binding => binding.required))!
      expect(availability).toBeTruthy()
      await page.goto(`/sites/${claimedProjectId}/outcomes/${availability.id}`)
      const outcomeCheck = page.getByRole('button', { name: SITE_BOARD_COPY.verifyFix, exact: true })
      await browserExpect(outcomeCheck).toBeEnabled()
      const outcomeResponse = page.waitForResponse(response => new URL(response.url()).pathname.endsWith(`/outcomes/${availability.id}/verify`) && response.request().method() === 'POST')
      await outcomeCheck.click()
      const outcomeAccepted = await outcomeResponse
      expect(outcomeAccepted.ok()).toBe(true)
      await complete((await outcomeAccepted.json()).auditId)
      const outcomeSection = page.locator('section').filter({ has: page.getByText(OUTCOME_DETAIL_COPY.state, { exact: true }) })
      await browserExpect(outcomeSection.getByRole('status').first()).toHaveText(outcomeStatusLabel('CLEAR', false), { timeout: 15_000 })
      await browserExpect(outcomeCheck).toBeEnabled()
      await page.screenshot({ path: directory + '/outcome-verified.png', fullPage: true })
      const flag = claimed.flags.find(item => item.checkId === 'buttons-no-text')!
      expect(flag).toBeTruthy()
      const panel = siteFlagPanelSchema.parse(await browserHttp('/api/sites/' + claimedProjectId + '/flags/' + flag.id))
      expect(panel.flag.repairGuidance).toBe('ready')
      await page.goto('/sites/' + claimedProjectId + '?flag=' + panel.flag.id)
      const copy = page.getByRole('button', { name: SITE_BOARD_COPY.copyPrompt, exact: true })
      await browserExpect(copy).toBeVisible()
      const prepared = await browserHttp('/api/sites/' + claimedProjectId + '/flags/' + flag.id + '/fix', { action: 'prepare' })
      writeFileSync(directory + '/repair-task.txt', prepared.prompt)
      expect(prepared.prompt).toContain('Recorded scan: ' + webOrigin + '/report/' + initialAuditId)
      expect(prepared.prompt).toContain('Agent-readable scan JSON: ' + webOrigin + '/api/reports/' + initialAuditId)
      expect((await browserHttp('/api/reports/' + initialAuditId)).id).toBe(initialAuditId)
      await copy.click()
      await browserExpect(page.getByRole('button', { name: SITE_DASHBOARD_COPY.bundleCopied, exact: true })).toBeVisible()
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(prepared.prompt)
      expect(await prisma.improvementCycleEvent.count({ where: { cycle: { projectId: claimedProjectId }, type: 'HANDOFF_COPIED' } })).toBeGreaterThan(0)

      await page.getByRole('button', { name: SITE_BOARD_COPY.verifyFix, exact: true }).click()
      const verifyDialog = page.getByRole('dialog', { name: SITE_BOARD_COPY.verifyFix, exact: true })
      await verifyDialog.getByRole('textbox', { name: SITE_BOARD_COPY.changeLabel }).fill('Name the existing action control')
      repaired = true
      const accepted = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/verify') && response.request().method() === 'POST')
      await verifyDialog.getByRole('button', { name: SITE_BOARD_COPY.verifyFix, exact: true }).click()
      const response = await accepted
      expect(response.ok()).toBe(true)
      const verification = await response.json()
      await complete(verification.verificationAuditId)
      await browserExpect(page.getByText(SITE_DASHBOARD_COPY.flagResolved, { exact: true })).toBeVisible({ timeout: 15_000 })
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: verification.attemptId } }))
        .toMatchObject({ outcome: 'IMPROVED', comparable: true })

      // Default monitoring can legitimately win admission after a repair.
      // Observe real settlement instead of disabling it or bypassing its lease.
      await vi.waitFor(async () => {
        expect(siteHomeViewSchema.parse(await browserHttp('/api/sites/' + claimedProjectId)).activeRuns).toEqual([])
      }, { timeout: 40_000, interval: 250 })
      repaired = false
      const recurring = await browserHttp('/api/sites/' + claimedProjectId + '/runs', { scope: 'category', area: 'accessibility' }, 'browser-recurrence')
      await complete(recurring.auditId)
      const recurringFlag = await prisma.flag.findFirstOrThrow({ where: { auditId: recurring.auditId, checkId: 'buttons-no-text' } })
      expect((await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: recurringFlag.id } })).improvementId).toBe(panel.flag.id)
      await browserExpect(page.getByRole('button', { name: SITE_BOARD_COPY.copyPrompt, exact: true })).toBeVisible({ timeout: 15_000 })
      await browserExpect(page.getByText(SITE_DASHBOARD_COPY.flagResolved, { exact: true })).toHaveCount(0)
      await page.screenshot({ path: directory + '/flag-recurred.png', fullPage: true })
      async function inspectSurface(surface: string, theme: string, width: number) {
        await page.setViewportSize({ width, height: 900 })
        await page.evaluate(() => document.fonts.ready)
        await page.mouse.move(0, 0)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        await page.screenshot({ path: `${directory}/${surface}-${theme}-${width}.png`, fullPage: true })
        const result = await new AxeBuilder({ page: page as never }).analyze()
        const inspected = await inspectAccessibilityViolations(page, result.violations)
        accessibility.push({ surface, theme, width, ...inspected })
        writeFileSync(directory + '/accessibility.json', JSON.stringify(accessibility, null, 2))
      }
      for (const theme of ['light', 'dark']) {
        if (theme === 'dark') {
          await page.setViewportSize({ width: 1280, height: 900 })
          await page.keyboard.press('Escape')
          await browserExpect(page.getByRole('dialog')).toHaveCount(0)
          await page.getByRole('button', { name: 'Toggle theme', exact: true }).click()
          await browserExpect(page.locator('html')).toHaveClass(/\bdark\b/)
          await page.goto('/sites/' + claimedProjectId + '?flag=' + panel.flag.id)
          await browserExpect(page.getByRole('dialog')).toBeVisible()
        }
        for (const width of [320, 375, 768, 1280]) await inspectSurface('flag', theme, width)
      }
      const dialog = page.getByRole('dialog')
      await dialog.locator('button').first().focus()
      for (let step = 0; step < 8; step++) {
        await page.keyboard.press('Tab')
        expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))).toBe(true)
      }
      await page.keyboard.press('Escape')
      await browserExpect(dialog).toHaveCount(0)
      await page.getByRole('button', { name: 'Toggle theme', exact: true }).click()
      await browserExpect(page.locator('html')).not.toHaveClass(/\bdark\b/)
      for (const theme of ['light', 'dark']) {
        if (theme === 'dark') {
          await page.setViewportSize({ width: 1280, height: 900 })
          await page.getByRole('button', { name: 'Toggle theme', exact: true }).click()
          await browserExpect(page.locator('html')).toHaveClass(/\bdark\b/)
        }
        for (const surface of ['Overview', 'Pages', 'Timeline', 'Integrations', 'Settings']) {
          await page.setViewportSize({ width: 1280, height: 900 })
          await page.getByRole('navigation', { name: 'Site', exact: true }).getByRole('link', { name: surface, exact: true }).click()
          await browserExpect(page.getByRole('heading', { level: 1 })).toBeVisible()
          for (const width of [1280, 375]) await inspectSurface(surface.toLowerCase(), theme, width)
        }
      }
      expect(accessibility.flatMap(sample => sample.failures)).toEqual([])
      expect(runtimeErrors).toEqual([])
      // Observe this compiled page on local infrastructure. These are lab
      // timings, without provider metrics or a field-percentile claim.
      await page.addInitScript(() => {
        const sample = { lcpMs: null as number | null, cls: 0, interactionsMs: [] as number[] }
        Object.assign(window, { fixflagsLocalPerformance: sample })
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) sample.lcpMs = entry.startTime
        }).observe({ type: 'largest-contentful-paint', buffered: true })
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            const shift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number }
            if (!shift.hadRecentInput) sample.cls += shift.value
          }
        }).observe({ type: 'layout-shift', buffered: true })
        new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            if ((entry as PerformanceEntry & { interactionId: number }).interactionId) sample.interactionsMs.push(entry.duration)
          }
        }).observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit)
      })
      await page.setViewportSize({ width: 1280, height: 900 })
      await page.goto('/sites/' + claimedProjectId)
      await browserExpect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await page.evaluate(() => document.fonts.ready)
      await page.getByRole('navigation', { name: 'Site', exact: true }).getByRole('link', { name: 'Pages', exact: true }).click()
      await browserExpect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await page.getByRole('navigation', { name: 'Site', exact: true }).getByRole('link', { name: 'Overview', exact: true }).click()
      await browserExpect(page.getByRole('heading', { level: 1 })).toBeVisible()
      const performance = await page.evaluate(() => ({
        ...(window as Window & { fixflagsLocalPerformance?: object }).fixflagsLocalPerformance,
        navigation: JSON.parse(JSON.stringify(window.performance.getEntriesByType('navigation'))),
      }))
      writeFileSync(directory + '/performance.json', JSON.stringify({ scope: 'local desktop Chromium lab observation',
        fieldPercentiles: false, representativeInp: false, ...performance }, null, 2))
      await page.goto('/sites/' + claimedProjectId + '?flag=' + panel.flag.id)
      await page.getByRole('button', { name: SITE_BOARD_COPY.verifyFix, exact: true }).click()
      const secondDialog = page.getByRole('dialog', { name: SITE_BOARD_COPY.verifyFix, exact: true })
      await secondDialog.getByRole('textbox', { name: SITE_BOARD_COPY.changeLabel }).fill('Restore the existing action name after recurrence')
      repaired = true
      const secondResponse = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/verify') && response.request().method() === 'POST')
      await secondDialog.getByRole('button', { name: SITE_BOARD_COPY.verifyFix, exact: true }).click()
      const secondAccepted = await secondResponse
      expect(secondAccepted.ok()).toBe(true)
      const secondVerification = await secondAccepted.json()
      await complete(secondVerification.verificationAuditId)
      await browserExpect(page.getByText(SITE_DASHBOARD_COPY.flagResolved, { exact: true })).toBeVisible({ timeout: 15_000 })
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: secondVerification.attemptId } }))
        .toMatchObject({ outcome: 'IMPROVED', comparable: true })
      await page.screenshot({ path: directory + '/flag-recovered-again.png', fullPage: true })
      if (authProof) {
        const cdp = await context.newCDPSession(page)
        await cdp.send('WebAuthn.enable')
        await cdp.send('WebAuthn.addVirtualAuthenticator', { options: {
          protocol: 'ctap2', transport: 'internal', hasResidentKey: true,
          hasUserVerification: true, isUserVerified: true,
        } })
        await page.goto('/settings')
        const enable = page.getByRole('button', { name: AUTH.security.enableCta, exact: true })
        await browserExpect(enable).toBeDisabled()
        const unregistered = await context.request.post(webOrigin + '/api/auth/two-factor/enable', {
          headers: { origin: webOrigin }, data: { password, method: 'totp' },
        })
        expect(unregistered.status()).toBe(400)
        expect((await prisma.user.findUniqueOrThrow({ where: { id: browserUserId } })).twoFactorEnabled).toBe(false)
        const registration = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/passkey/verify-registration'))
        await page.getByRole('button', { name: AUTH.security.addPasskey, exact: true }).click()
        expect((await registration).ok()).toBe(true)
        await browserExpect(enable).toBeEnabled()
        await page.locator('#two-factor-password').fill(password)
        const enrollment = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/two-factor/enable'))
        await enable.click()
        const enrolled = await enrollment
        expect(enrolled.ok()).toBe(true)
        const recovery = await enrolled.json()
        expect(recovery.method).toBe('totp')
        expect(recovery.backupCodes.length).toBeGreaterThan(0)
        await browserExpect(page.getByText(recovery.backupCodes[0], { exact: true })).toBeVisible()
        for (const path of ['/two-factor/get-totp-uri', '/two-factor/verify-totp']) {
          const refused = await context.request.post(webOrigin + '/api/auth' + path, {
            headers: { origin: webOrigin }, data: { password, code: '000000' },
          })
          expect(refused.status()).toBe(404)
        }
        async function challenge() {
          expect((await context.request.post(webOrigin + '/api/auth/sign-out', { headers: { origin: webOrigin }, data: {} })).ok()).toBe(true)
          await page.goto('/sign-in')
          await page.getByLabel('Email', { exact: true }).fill(browserUserId + '@example.test')
          await page.getByLabel('Password', { exact: true }).fill(password)
          await page.getByRole('button', { name: 'Sign in', exact: true }).click()
          await page.waitForURL(location => location.pathname === '/two-factor')
        }
        await challenge()
        await page.getByRole('button', { name: 'Continue with passkey', exact: true }).click()
        await page.waitForURL(location => !location.pathname.startsWith('/two-factor'))
        expect((await (await context.request.get(webOrigin + '/api/auth/get-session')).json()).user.twoFactorEnabled).toBe(true)
        await challenge()
        await page.getByLabel('Backup code', { exact: true }).fill(recovery.backupCodes[0])
        await page.getByRole('button', { name: 'Verify backup code', exact: true }).click()
        await page.waitForURL(location => !location.pathname.startsWith('/two-factor'))
        expect((await (await context.request.get(webOrigin + '/api/auth/get-session')).json()).user.twoFactorEnabled).toBe(true)
        await challenge()
        const replay = await context.request.post(webOrigin + '/api/auth/two-factor/verify-backup-code', {
          headers: { origin: webOrigin }, data: { code: recovery.backupCodes[0] },
        })
        expect(replay.ok()).toBe(false)
        expect(await (await context.request.get(webOrigin + '/api/auth/get-session')).json()).toBeNull()
      }
      writeFileSync(directory + '/observations.json', JSON.stringify({ scope: 'local API-admitted Site, browser claim, compiled category repair and recurrence',
        ordinaryUrlEntry: false, loopbackRefusedByUi: true, admission: 'normal API with existing explicit local-fixture option',
        ordinaryBrowserSignIn: true, sameEvidenceClaimed: true, defaultMonitoring: true, outcomeCompletionObservedInBrowser: true,
        fixtureAccount: 'ordinary verified account seeded in disposable database, not email delivery proof',
        nativeClipboardReadback: true, independentWorkerRecovery: true,
        durableRecurrenceIdentity: true, secondIndependentRecovery: true,
        passkeyAndBackupRecovery: authProof, publicTotpRefused: authProof, backupReplayRefused: authProof,
        sourceAuditId: initialAuditId, recurrenceAuditId: recurring.auditId,
        verificationAuditIds: [verification.verificationAuditId, secondVerification.verificationAuditId],
        runtimeErrors, accessibility, fullWcagAaCompliance: false,
        realProvidersUsed: false, providerTransport: 'explicit local refusal', productionChanged: false, candidateFrozen: false }, null, 2))
    } finally {
      await page.screenshot({ path: directory + '/last-state.png', fullPage: true }).catch(() => {})
      await context.tracing.stop({ path: directory + '/trace.zip' })
      await browser.close()
    }
  }, 360_000)
})
