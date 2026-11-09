import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { hashPassword } from 'better-auth/crypto'
import { randomBytes } from 'node:crypto'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { loadEnvConfig } from '@next/env'
import AxeBuilder from '@axe-core/playwright'
import { SITE_BOARD_COPY } from '../lib/marketing/copy/terminology'
import { SITE_DASHBOARD_COPY } from '../lib/marketing/copy/site-dashboard'
import { AUTH } from '../lib/marketing/copy/auth'
import { COPIED_HANDOFF_CLIENT } from '../lib/improvements/handoff-contract'
import { readOutcomeIncident } from '../lib/sites/domain/outcome-incident'
import { PUBLIC_SITE_COPY } from '../lib/marketing/copy/public-site'
import type { SiteHomeView } from '../lib/sites/application/queries'
import { verifyClaimSignup } from './support/verify-claim-signup'

test.use({ ignoreHTTPSErrors: true })

test('controlled checkout Flag, native handoff, independent recovery and recurrence', async ({ page, browser, baseURL }, testInfo) => {
  test.skip(process.env.FIXFLAGS_LOCAL_RELIABILITY_PROOF !== '1', 'Explicit isolated local proof only')
  test.setTimeout(900_000)
  loadEnvConfig(process.cwd())
  if (!baseURL || !['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname)) throw new Error('Local app required')
  const database = new URL(process.env.DATABASE_URL!)
  if (!['127.0.0.1', 'localhost'].includes(database.hostname) || !/^\/fixflags_category_journey_[a-f0-9]+$/.test(database.pathname)) throw new Error('Disposable journey database required')
  const runtime = JSON.parse(await readFile('.cache/customer-reliability-runtime.json', 'utf8'))
  const control = async (data?: object) => {
    const response = data ? await page.request.post(`${runtime.fixtureOrigin}/control`, { headers: { Authorization: `Bearer ${runtime.token}` }, data }) : await page.request.get(`${runtime.fixtureOrigin}/control`, { headers: { Authorization: `Bearer ${runtime.token}` } })
    expect(response.ok()).toBe(true); return response.json()
  }
  const db = new PrismaClient()
  const nonce = randomBytes(8).toString('hex')
  const email = `reliability-${nonce}@example.invalid`, password = `Ff!${randomBytes(18).toString('base64url')}`
  const output = testInfo.outputPath('observations')
  await mkdir(output, { recursive: true })
  const proof: Record<string, unknown> = { environment: 'local production web + real queue/worker/Chromium/PostgreSQL; controlled HTTP, email and S3-compatible protocol transports; not external provider or production proof' }
  try {
    if (process.env.FIXFLAGS_PUBLIC_FIXTURE_PROOF === '1') {
    // Reproduce the previous public example.com findings without mapping its transport.
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': `2001:db8:${nonce.slice(0, 4)}:${nonce.slice(4, 8)}::2` })
    const initial = await page.request.post('/api/checks', { headers: { 'x-forwarded-for': `2001:db8:${nonce.slice(0, 4)}:${nonce.slice(4, 8)}::2` }, data: { url: `https://example.com/?reliability=${nonce}` } })
    expect(initial.ok(), await initial.text()).toBe(true)
    const publicAuditId = (await initial.json()).reportId
    await expect.poll(async () => (await db.audit.findUnique({ where: { id: publicAuditId } }))?.status, { timeout: 180000, intervals: [1500] }).toBe('COMPLETED')
    const publicAudit = await db.audit.findUnique({ where: { id: publicAuditId }, include: { flags: true, screenshots: true } })
    await writeFile(`${output}/public-fixture-findings.json`, JSON.stringify({ auditId: publicAuditId, flags: publicAudit!.flags.map(({ id, checkId, problem, evidence, fix, severity, confidence, pageUrl }) => ({ id, checkId, problem, evidence, fix, severity, confidence, pageUrl })), metadata: publicAudit!.htmlMetadata }, null, 2))
    // Archive only real captured bytes, never a reconstructed screenshot.
    const publicCapture = await page.request.get(`/api/screenshots/${publicAuditId}/desktop?page=p0`)
    expect(publicCapture.status()).toBe(200); await writeFile(`${output}/public-fixture-desktop.png`, await publicCapture.body())
    proof.publicFixture = { auditId: publicAuditId, findings: publicAudit!.flags.length }

    }

    const target = `https://example.com${runtime.prefix}/products/trail-pack`
    const siteOrigin = new URL(target).origin
    await control({ fixtureEnabled: true, broken: false, checkoutForm: true })
    await page.goto('/new')
    const entryConsent = page.getByRole('button', { name: 'Only necessary', exact: true })
    if (await entryConsent.isVisible()) await entryConsent.click()
    await page.getByLabel('Website URL').first().fill(target)
    await page.getByRole('button', { name: PUBLIC_SITE_COPY.analyze, exact: true }).first().click()
    await page.waitForURL(/\/sites\//)
    const siteId = new URL(page.url()).pathname.split('/').filter(Boolean).at(-1)!
    const getSiteHome = () => page.evaluate(async id => {
      const response = await fetch(`/api/sites/${id}`, { cache: 'no-store' })
      return { status: response.status, body: await response.json() as SiteHomeView }
    }, siteId)
    await expect.poll(async () => {
      const response = await getSiteHome()
      return response.status === 200 ? response.body.audit?.status : `HTTP ${response.status}`
    }, { timeout: 150_000, intervals: [1000] }).toBe('COMPLETED')
    const original = (await getSiteHome()).body
    expect(original.site.userId).toBeNull()
    expect(original.site.url).toBe(siteOrigin)
    const originalAuditId = original.audit?.id
    if (!originalAuditId) throw new Error('Anonymous analysis has no completed report')
    const originalCheckout = original.outcomes.find(item => item.slug === 'checkout')
    if (!originalCheckout) throw new Error('Checkout was not inferred from the product page')
    await page.getByRole('button', { name: 'Open Search', exact: true }).click()
    await page.getByRole('dialog').locator('summary').filter({ hasText: SITE_DASHBOARD_COPY.checkDetails }).click()
    await page.getByRole('dialog').getByRole('button', { name: /^Check(?: Search)? again$/ }).last().click()
    const userId = await verifyClaimSignup({ page, db, email, password, origin: new URL(baseURL).origin,
      messages: async () => (await control()).messages,
      stillAnonymous: async () => { expect((await getSiteHome()).body.site.userId).toBeNull() },
    })
    await page.waitForURL(url => url.pathname === `/sites/${siteId}` && url.searchParams.get('category') === 'search')
    const claimed = (await getSiteHome()).body
    const projectId = claimed.site.projectId
    if (!projectId) throw new Error('Signup did not claim the analyzed Site')
    expect(claimed.site).toMatchObject({ userId, url: siteOrigin })
    expect(await db.user.findUniqueOrThrow({ where: { id: userId }, select: { emailVerified: true } })).toEqual({ emailVerified: true })
    expect(await db.audit.findUniqueOrThrow({ where: { id: originalAuditId }, select: { userId: true, projectId: true, url: true } }))
      .toEqual({ userId, projectId, url: target })
    expect(claimed.monitoringHistory).toEqual(expect.arrayContaining([expect.objectContaining({ id: originalAuditId })]))
    expect(await db.project.findUniqueOrThrow({ where: { id: projectId }, select: { watchInterval: true, watchNextRunAt: true } }))
      .toEqual({ watchInterval: 'WEEKLY', watchNextRunAt: expect.any(Date) })
    await expect.poll(() => db.uptimeMonitor.findUnique({ where: { projectId }, select: { enabled: true, targetUrl: true } }))
      .toEqual({ enabled: true, targetUrl: new URL(siteOrigin).href })
    const outcome = await db.siteOutcome.findFirstOrThrow({ where: { projectId, kind: 'CHECKOUT', slug: 'checkout' }, include: { bindings: true } })
    expect(outcome).toMatchObject({ id: originalCheckout.id, inferenceSource: 'browser', confirmedAt: expect.any(Date),
      bindings: [expect.objectContaining({ key: 'checkout-browser-v1', required: true, config: expect.objectContaining({ startUrl: target, safety: 'stop-at-checkout' }) })] })
    const settings = await page.request.patch(`/api/sites/${projectId}/settings`, { data: { notificationLevel: 'FLAGS', notifyOnRecovery: true } })
    expect(settings.ok(), await settings.text()).toBe(true)
    proof.claim = { siteId, projectId, originalAuditId, outcomeId: outcome.id, signupVerified: true, defaultWeeklyWatch: true, defaultUptimeEnabled: true, checkoutInferred: true }
    const firstWatch = () => db.runRequest.findFirst({ where: { projectId, source: 'WATCH' }, orderBy: { requestedAt: 'asc' },
      select: { id: true, status: true, assessments: { select: { outcomeId: true, state: true } } } })
    await expect.poll(firstWatch, { timeout: 150_000, intervals: [1000] }).toMatchObject({ status: 'COMPLETED',
      assessments: expect.arrayContaining([expect.objectContaining({ outcomeId: outcome.id, state: 'CLEAR' })]) })
    proof.automaticFirstWatch = { runId: (await firstWatch())!.id, checkoutResult: 'CLEAR' }
    const run = async (label: string) => {
      const response = await page.request.post(`/api/sites/${projectId}/runs`, { headers: { 'Idempotency-Key': `reliability:${nonce}:${label}` }, data: { outcomeIds: [outcome.id] } })
      expect([200, 202], await response.text()).toContain(response.status()); return response.json()
    }
    const waitRun = async (runId: string, result: string) => {
      await expect.poll(async () => {
        const response = await page.request.get(`/api/sites/${projectId}/runs/${runId}`)
        if (!response.ok()) return `HTTP ${response.status()}`
        const value = await response.json(); return value.status
      }, { timeout: 180000, intervals: [1500] }).toBe('COMPLETED')
      const finished = await (await page.request.get(`/api/sites/${projectId}/runs/${runId}`)).json(); expect(finished.result).toBe(result)
      return (await db.runRequest.findUnique({ where: { id: runId } }))!
    }
    await control({ checkoutForm: false })
    const unavailableCheckout = await run('empty-checkout'); await waitRun(unavailableCheckout.runId, 'COULD_NOT_VERIFY')
    await control({ checkoutForm: true })
    const baseline = await run('baseline'); const baselineRecord = await waitRun(baseline.runId, 'CLEAR')
    proof.checkoutBaseline = { runId: baseline.runId, auditId: baselineRecord.auditId, result: 'CLEAR' }
    if (process.env.FIXFLAGS_EXPERIENCE_CAPTURE === '1') {
      for (const [name, width] of [['desktop', 1440], ['mobile', 390]] as const) {
        await page.setViewportSize({ width, height: 900 })
        await page.goto(`/sites/${projectId}`, { waitUntil: 'networkidle' })
        const consent = page.getByRole('button', { name: 'Only necessary', exact: true })
        if (await consent.isVisible()) await consent.click()
        await page.screenshot({ path: `${output}/${name}-overview.png`, fullPage: true })
        await page.goto(`/sites/${projectId}/outcomes/${outcome.id}`, { waitUntil: 'networkidle' })
        await page.screenshot({ path: `${output}/${name}-check.png`, fullPage: true })
        await page.goto(`/sites/${projectId}/settings`, { waitUntil: 'networkidle' })
        await page.screenshot({ path: `${output}/${name}-settings.png`, fullPage: true })
      }
      await page.setViewportSize({ width: 1440, height: 900 })
    }
    const requestDueWatch = async () => {
      // Resume this fixture through the owner command to make the cadence due.
      for (const action of ['pause', 'resume']) {
        const changed = await page.request.post(`/api/sites/${projectId}/watch`, { data: { action } })
        expect(changed.status(), await changed.text()).toBe(200)
      }
      // The isolated runtime owns scheduler invocation and rejects unrelated due Sites.
      const scheduled = await page.request.post(`${runtime.fixtureOrigin}/tick`, { headers: { Authorization: `Bearer ${runtime.token}` }, data: { projectId } })
      expect(scheduled.ok(), await scheduled.text()).toBe(true)
      return await scheduled.json() as { runId: string }
    }
    await control({ broken: true, rejectCheckoutOutcomeId: outcome.id })
    const watch = await requestDueWatch()
    const failedRecord = await waitRun(watch.runId, 'FLAG')
    const alertMessages = async () => (await control()).messages.filter((message: { tags?: { name: string; value: string }[] }) =>
      message.tags?.some(tag => tag.name === 'audit_id' && tag.value === failedRecord.auditId))
    await expect.poll(async () => (await db.audit.findUnique({ where: { id: failedRecord.auditId! } }))?.improvementProjectedAt).not.toBeNull()
    // The isolated runtime invokes delivery scheduling explicitly, just as it
    // invokes the Watch scheduler above. Classification alone does not send.
    const delivered = await page.request.post(`${runtime.fixtureOrigin}/retry`, { headers: { Authorization: `Bearer ${runtime.token}` } })
    expect(delivered.ok(), await delivered.text()).toBe(true)
    await expect.poll(async () => (await db.audit.findUnique({ where: { id: failedRecord.auditId! } }))?.watchNotificationStatus).toBe('FAILED')
    const firstFailure = await db.audit.findUniqueOrThrow({ where: { id: failedRecord.auditId! } })
    expect(firstFailure.watchNotificationNextAttemptAt).not.toBeNull()
    const retryDueAt = firstFailure.watchNotificationNextAttemptAt!.getTime()
    expect(retryDueAt).toBeGreaterThan(Date.now())
    const premature = await page.request.post(`${runtime.fixtureOrigin}/retry`, { headers: { Authorization: `Bearer ${runtime.token}` } })
    expect(premature.ok()).toBe(true)
    expect((await db.audit.findUniqueOrThrow({ where: { id: failedRecord.auditId! } })).watchNotificationAttempts).toBe(firstFailure.watchNotificationAttempts)
    expect(await alertMessages()).toHaveLength(0)
    // Observe the persisted backoff in real time. Never rewrite its due time or the clock.
    await expect.poll(() => Date.now(), { timeout: 360_000, intervals: [1000] }).toBeGreaterThanOrEqual(retryDueAt)
    const retried = await page.request.post(`${runtime.fixtureOrigin}/retry`, { headers: { Authorization: `Bearer ${runtime.token}` } })
    expect(retried.ok()).toBe(true)
    await expect.poll(async () => (await db.audit.findUnique({ where: { id: failedRecord.auditId! } }))?.watchNotificationStatus).toBe('SENT')
    const messages = await alertMessages(); expect(messages).toHaveLength(1)
    expect(messages[0].to).toBe(email)
    expect(messages[0].html).toContain(`/sites/${projectId}/flags/`)
    await writeFile(`${output}/notification.html`, messages[0].html)
    await page.request.post(`${runtime.fixtureOrigin}/retry`, { headers: { Authorization: `Bearer ${runtime.token}` } })
    expect(await alertMessages()).toHaveLength(1)
    const inbox = await browser.newPage(); await inbox.setContent(messages[0].html); await inbox.screenshot({ path: `${output}/notification.png`, fullPage: true }); await inbox.close()
    const destination = messages[0].html.match(/href="([^"]+)"/)[1]
    const emailDestination = new URL(destination)
    expect(emailDestination.origin).toBe(new URL(baseURL).origin)
    expect(emailDestination.pathname).toMatch(new RegExp(`^/sites/${projectId}/flags/[^/]+$`))
    const notificationPath = emailDestination.pathname + emailDestination.search
    const emailContext = await browser.newContext()
    try {
      const emailPage = await emailContext.newPage()
      await emailPage.goto(destination, { waitUntil: 'networkidle' })
      await expect(emailPage).toHaveURL(url => url.pathname === '/sign-in' && url.searchParams.get('next') === notificationPath)
      const privateEndpoint = '/api' + emailDestination.pathname
      expect((await emailPage.request.get(privateEndpoint)).status()).toBe(404)
      const consent = emailPage.getByRole('button', { name: 'Only necessary', exact: true })
      if (await consent.isVisible()) await consent.click()
      await emailPage.getByLabel('Email').fill(email)
      await emailPage.getByLabel('Password', { exact: true }).fill(password)
      await emailPage.getByRole('button', { name: AUTH.signIn.cta, exact: true }).click()
      await emailPage.waitForURL(url => url.pathname + url.search === notificationPath)
      await expect(emailPage.getByRole('heading', { level: 1 }).first()).toBeVisible()
      const returned = await emailPage.request.get(privateEndpoint)
      expect(returned.status(), await returned.text()).toBe(200)
      expect((await returned.json()).flag.sourceAuditId).toBe(failedRecord.auditId)
      proof.notificationReturn = { signedOutDestination: notificationPath, privateBeforeSignIn: true,
        exactFlagAfterSignIn: true, sourceAuditId: failedRecord.auditId }
    } finally { await emailContext.close() }
    await page.goto(destination, { waitUntil: 'networkidle' }); await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    proof.notification = { transport: 'real Resend SDK to local controlled inbox', attempts: (await db.audit.findUnique({ where: { id: failedRecord.auditId! } }))!.watchNotificationAttempts, acceptedMessages: messages.length, retryDueAt: new Date(retryDueAt).toISOString(), observedAfterDueAt: new Date().toISOString(), prematureRetryConsumedNoAttempt: true }
    const home = await (await page.request.get(`/api/sites/${projectId}`)).json()
    const checkout = home.outcomes.find((item: { id: string }) => item.id === outcome.id)
    expect(checkout.state).toBe('FLAG'); expect(checkout.flagId).toBeTruthy()
    const flag = home.flags.find((item: { id: string; improvementId: string }) => item.id === checkout.flagId || item.improvementId === checkout.flagId)
    expect(flag, 'Outcome attribution identifies the actual Flag').toBeTruthy()
    expect(flag.evidence).toBeTruthy(); expect(flag.fix).toBeTruthy()
    const flagId = flag.id
    proof.failure = { runId: watch.runId, flagId, problem: flag.problem, evidence: flag.evidence, fix: flag.fix }
    await page.goto(`/sites/${projectId}/flags/${flagId}`, { waitUntil: 'networkidle' })
    await expect(page.getByText(flag.problem, { exact: false }).first()).toBeVisible()
    const evidenceImage = page.getByRole('img', { name: SITE_BOARD_COPY.flagCaptureAlt })
    await expect(evidenceImage).toBeVisible(); await expect.poll(() => evidenceImage.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
    const consent = page.getByRole('button', { name: 'Only necessary', exact: true }); if (await consent.isVisible()) await consent.click()
    const exactCapture = (await evidenceImage.getAttribute('src'))!
    const capturedResponse = await page.request.get(exactCapture); expect(capturedResponse.status()).toBe(200)
    await writeFile(`${output}/checkout-failure.png`, await capturedResponse.body())
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseURL })
    await page.getByLabel(SITE_DASHBOARD_COPY.promptPreview, { exact: true }).click()
    const preview = page.getByRole('textbox', { name: SITE_BOARD_COPY.fixPromptLabel, exact: true })
    await expect(preview).toBeVisible()
    const instructions = await preview.inputValue()
    expect(instructions).toContain(flag.problem)
    expect(instructions).toContain(flag.evidence)
    const copyRecorded = page.waitForResponse(response => response.url().endsWith(`/flags/${flagId}/fix`) &&
      response.request().method() === 'POST' && response.request().postDataJSON().action === 'copy')
    await page.getByRole('button', { name: SITE_BOARD_COPY.copyPrompt, exact: true }).click()
    await expect(page.getByRole('button', { name: SITE_BOARD_COPY.copyPromptCopied, exact: true })).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(instructions)
    const handoff = await copyRecorded
    expect(handoff.ok(), await handoff.text()).toBe(true)
    const copyEvent = await db.improvementCycleEvent.findFirstOrThrow({
      where: { cycle: { projectId, sourceAuditId: failedRecord.auditId! }, type: 'HANDOFF_COPIED', client: COPIED_HANDOFF_CLIENT },
    })
    proof.handoff = { eventId: copyEvent.id, previewMatchesClipboard: true, nativeReceipt: true }
    expect((await (await page.request.get(`/api/sites/${projectId}`)).json()).outcomes.find((item: { id: string }) => item.id === outcome.id).state).toBe('FLAG')
    await page.screenshot({ path: `${output}/desktop-flag.png`, fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: `${output}/mobile-flag.png`, fullPage: true })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const a11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    await writeFile(`${output}/accessibility.json`, JSON.stringify(a11y.violations, null, 2)); expect(a11y.violations).toEqual([])

    // The claimed discovery capture retains its original source. The separate
    // failure image above belongs to this checkout attempt's journey evidence.
    const audit = await db.audit.findUnique({ where: { id: originalAuditId }, include: { screenshots: true } })
    expect(audit!.isPublic).toBe(false); expect(audit!.screenshots.length).toBeGreaterThan(0)
    const storedCapture = audit!.screenshots.find(capture => capture.device === 'DESKTOP')
    expect(storedCapture).toBeTruthy()
    const shotUrl = new URL(storedCapture!.url, baseURL)
    expect(shotUrl.origin).toBe(new URL(baseURL).origin)
    expect(shotUrl.pathname).toBe(`/api/screenshots/${audit!.id}/desktop`)
    const shotPath = shotUrl.pathname + shotUrl.search
    const shot = await page.request.get(shotPath); expect(shot.status()).toBe(200)
    expect(shot.headers()['cache-control']).toContain('private'); expect((await shot.body()).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    const stranger = await browser.newContext({ baseURL, ignoreHTTPSErrors: true })
    expect((await stranger.request.get(shotPath)).status()).toBe(404)
    expect((await stranger.request.get(exactCapture)).status()).toBe(403)
    expect((await stranger.request.get(`/api/sites/${projectId}`)).status()).not.toBe(200)
    const foreign = await db.user.create({ data: { email: `reliability-stranger-${nonce}@example.invalid`, name: 'Other owner', emailVerified: true } })
    try {
      await db.account.create({ data: { userId: foreign.id, accountId: foreign.id, providerId: 'credential', password: await hashPassword(password) } })
      expect((await stranger.request.post('/api/auth/sign-in/email', { headers: { Origin: baseURL }, data: { email: foreign.email, password } })).ok()).toBe(true)
      expect((await stranger.request.get(exactCapture)).status()).toBe(403)
      expect((await stranger.request.get(shotPath)).status()).toBe(404)
      expect((await stranger.request.post(`/api/sites/${projectId}/flags/${flagId}/verify`, { data: {} })).status()).not.toBe(202)
    } finally { await stranger.close(); await db.user.delete({ where: { id: foreign.id } }) }
    const pageKey = shotUrl.searchParams.get('page')
    const objectKey = `screenshots/${audit!.id}/${pageKey ? `${pageKey}-` : ''}desktop.png`
    expect((await control()).objects).toContain(objectKey)
    expect((await page.request.get(`${runtime.fixtureOrigin}/evidence/${objectKey}`)).status()).toBe(403)
    proof.privateEvidence = 'actual worker capture -> signed S3 SDK PUT -> private object -> owner-authorized GET; anonymous Site/screenshot and unsigned object access denied'

    const verify = async (referenceFlagId: string) => {
      await page.goto(`/sites/${projectId}/flags/${referenceFlagId}`, { waitUntil: 'networkidle' })
      const currentResponse = await page.request.get(`/api/sites/${projectId}/flags/${referenceFlagId}`)
      expect(currentResponse.ok()).toBe(true)
      expect((await currentResponse.json()).flag).toBeTruthy()
      await expect(page.getByRole('button', { name: SITE_BOARD_COPY.verifyFix, exact: true })).toBeEnabled()
      await page.getByRole('button', { name: SITE_BOARD_COPY.verifyFix, exact: true }).click()
      const responseWait = page.waitForResponse(response => response.url().endsWith(`/flags/${referenceFlagId}/verify`) && response.request().method() === 'POST')
      await page.getByRole('dialog').getByRole('button', { name: SITE_BOARD_COPY.verifyFix, exact: true }).click()
      const response = await responseWait
      expect(response.status(), await response.text()).toBe(202)
      const accepted = await response.json(); expect(accepted.flagId).toBe(referenceFlagId); return accepted
    }
    const unresolved = await verify(flagId); await waitRun(unresolved.runId, 'FLAG')
    proof.unresolvedVerification = { runId: unresolved.runId, result: 'FLAG' }
    await control({ broken: false, checkoutForm: false })
    const incomplete = await verify(flagId); await waitRun(incomplete.runId, 'COULD_NOT_VERIFY')
    await expect.poll(async () => (await db.improvementAttempt.findUnique({ where: { id: incomplete.attemptId } }))?.outcome).toBe('INCONCLUSIVE')
    proof.incompleteVerification = { runId: incomplete.runId, result: 'COULD_NOT_VERIFY' }
    await control({ checkoutForm: true })
    const recovered = await verify(flagId); const recoveredRecord = await waitRun(recovered.runId, 'CLEAR')
    const after = await (await page.request.get(`/api/sites/${projectId}`)).json()
    expect(after.outcomes.find((item: { id: string }) => item.id === outcome.id).state).toBe('CLEAR')
    proof.recoveryExecution = { runId: recovered.runId, auditId: recoveredRecord.auditId, result: 'CLEAR' }
    await page.reload({ waitUntil: 'networkidle' }); await expect(page.getByText('Recovered', { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: SITE_BOARD_COPY.checkoutRecovered, exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: SITE_BOARD_COPY.previousFailure, exact: true })).toBeVisible()
    await page.screenshot({ path: `${output}/mobile-recovery.png`, fullPage: true })
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.screenshot({ path: `${output}/desktop-recovery.png`, fullPage: true })
    proof.recovery = { runId: recovered.runId, auditId: recoveredRecord.auditId, result: 'CLEAR', customerStatus: 'Recovered' }
    await control({ broken: true })
    const recurrence = await requestDueWatch()
    expect(recurrence.runId).not.toBe(watch.runId)
    expect(await waitRun(recurrence.runId, 'FLAG')).toMatchObject({ source: 'WATCH' })
    const recurringAssessment = await db.outcomeAssessment.findUniqueOrThrow({
      where: { runRequestId_outcomeId: { runRequestId: recurrence.runId, outcomeId: outcome.id } },
    })
    const incident = readOutcomeIncident(recurringAssessment.evidence)
    expect(incident?.transition).toBe('regression')
    expect(incident?.flagIds).toHaveLength(1)
    const recurringFlagId = incident!.flagIds[0]
    expect(recurringFlagId).not.toBe(flagId)
    expect(await db.flag.findUnique({ where: { id: recurringFlagId }, select: { status: true } })).toEqual({ status: 'REGRESSED' })
    await control({ broken: false })
    const secondRepair = await verify(recurringFlagId)
    const secondRecovery = await waitRun(secondRepair.runId, 'CLEAR')
    await expect.poll(async () => (await db.flag.findUnique({ where: { id: recurringFlagId } }))?.resolvedInId).toBe(secondRecovery.auditId)
    const firstRecovery = await db.outcomeAssessment.findUniqueOrThrow({
      where: { runRequestId_outcomeId: { runRequestId: recovered.runId, outcomeId: outcome.id } },
    })
    expect(readOutcomeIncident(firstRecovery.evidence)?.transition).toBe('recovery')
    proof.recurrence = { runId: recurrence.runId, flagId: recurringFlagId, previousAssessmentId: incident!.previousAssessmentId }
    proof.secondRecovery = { runId: secondRepair.runId, auditId: secondRecovery.auditId }
    const attempts = await db.outcomeBindingAttempt.findMany({ where: { outcomeId: outcome.id }, orderBy: { createdAt: 'asc' } })
    proof.bindingAttempts = attempts.map(({ auditId, disposition, reason, detail }) => ({ auditId, disposition, reason, detail }))
    proof.history = await db.improvementAttempt.findMany({ where: { improvement: { projectId, outcomeId: outcome.id } }, select: { outcome: true, comparable: true, verificationAuditId: true, changeSummary: true } })
    const history = proof.history as Array<{ outcome: string; comparable: boolean; changeSummary: string | null }>
    expect(history.some(attempt => attempt.outcome === 'UNCHANGED' && attempt.comparable)).toBe(true)
    expect(history.some(attempt => attempt.outcome === 'IMPROVED' && attempt.comparable)).toBe(true)
    expect(history.every(attempt => attempt.changeSummary === null)).toBe(true)
    const final = await control(); proof.observedRequests = final.requests
    expect(final.requests.some((request: { path: string; status: number }) => request.path.endsWith('/checkout') && request.status === 503)).toBe(true)
    expect(final.requests.some((request: { path: string; status: number }) => request.path.endsWith('/checkout') && request.status === 200)).toBe(true)
    proof.continuedMonitoring = (await db.project.findUnique({ where: { id: projectId } }))!.watchNextRunAt
  } finally {
    await writeFile(`${output}/run-${nonce}-proof.json`, JSON.stringify(proof, null, 2))
    if (proof.recovery || !proof.checkoutBaseline) await writeFile(`${output}/real-path-proof.json`, JSON.stringify(proof, null, 2))
    // The isolated runner owns the database and removes it after stopping the worker.
    await db.$disconnect()
  }
})
