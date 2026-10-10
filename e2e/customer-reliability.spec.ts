import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { hashPassword } from 'better-auth/crypto'
import { randomBytes } from 'node:crypto'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { loadEnvConfig } from '@next/env'
import AxeBuilder from '@axe-core/playwright'

test.use({ ignoreHTTPSErrors: true })

test('controlled customer Flag, unresolved verification, repair, recovery and private evidence', async ({ page, browser, baseURL }) => {
  test.skip(process.env.FIXFLAGS_LOCAL_RELIABILITY_PROOF !== '1', 'Explicit isolated local proof only')
  test.setTimeout(900_000)
  loadEnvConfig(process.cwd())
  if (!baseURL || !['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname)) throw new Error('Local app required')
  if (!['127.0.0.1', 'localhost'].includes(new URL(process.env.DATABASE_URL!).hostname)) throw new Error('Local database required')
  const runtime = JSON.parse(await readFile('.cache/customer-reliability-runtime.json', 'utf8'))
  const control = async (data?: object) => {
    const response = data ? await page.request.post(`${runtime.fixtureOrigin}/control`, { headers: { Authorization: `Bearer ${runtime.token}` }, data }) : await page.request.get(`${runtime.fixtureOrigin}/control`, { headers: { Authorization: `Bearer ${runtime.token}` } })
    expect(response.ok()).toBe(true); return response.json()
  }
  const db = new PrismaClient()
  const nonce = randomBytes(8).toString('hex')
  const email = `reliability-${nonce}@example.invalid`, password = `Ff!${randomBytes(18).toString('base64url')}`
  const output = '.agents/artifacts/customer-reliability'; await mkdir(output, { recursive: true })
  const proof: Record<string, unknown> = { environment: 'local production web + real queue/worker/Chromium/PostgreSQL; controlled HTTP, email and S3-compatible protocol transports; not external provider or production proof' }
  const user = await db.user.create({ data: { email, name: 'Reliability <fixture>', emailVerified: true, auditsUsed: 3 } })
  await db.account.create({ data: { userId: user.id, accountId: user.id, providerId: 'credential', password: await hashPassword(password) } })
  let projectId: string | undefined
  const auditIds: string[] = []
  try {
    if (process.env.FIXFLAGS_PUBLIC_FIXTURE_PROOF === '1') {
    // Reproduce the previous public example.com findings without mapping its transport.
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': `2001:db8:${nonce.slice(0, 4)}:${nonce.slice(4, 8)}::2` })
    const initial = await page.request.post('/api/checks', { headers: { 'x-forwarded-for': `2001:db8:${nonce.slice(0, 4)}:${nonce.slice(4, 8)}::2` }, data: { url: `https://example.com/?reliability=${nonce}` } })
    expect(initial.ok(), await initial.text()).toBe(true)
    const publicAuditId = (await initial.json()).reportId; auditIds.push(publicAuditId)
    await expect.poll(async () => (await db.audit.findUnique({ where: { id: publicAuditId } }))?.status, { timeout: 180000, intervals: [1500] }).toBe('COMPLETED')
    const publicAudit = await db.audit.findUnique({ where: { id: publicAuditId }, include: { flags: true, screenshots: true } })
    await writeFile(`${output}/public-fixture-findings.json`, JSON.stringify({ auditId: publicAuditId, flags: publicAudit!.flags.map(({ id, checkId, problem, evidence, fix, severity, confidence, pageUrl }) => ({ id, checkId, problem, evidence, fix, severity, confidence, pageUrl })), metadata: publicAudit!.htmlMetadata }, null, 2))
    // Archive only real captured bytes, never a reconstructed screenshot.
    const publicCapture = await page.request.get(`/api/screenshots/${publicAuditId}/desktop?page=p0`)
    expect(publicCapture.status()).toBe(200); await writeFile(`${output}/public-fixture-desktop.png`, await publicCapture.body())
    proof.publicFixture = { auditId: publicAuditId, findings: publicAudit!.flags.length }

    }

    // Account and Site setup are disposable fixtures; execution and verdicts are the real product.
    const signedIn = await page.request.post('/api/auth/sign-in/email', { headers: { Origin: baseURL }, data: { email, password } })
    expect(signedIn.ok(), await signedIn.text()).toBe(true)
    const target = `https://example.com${runtime.prefix}`
    const project = await db.project.create({ data: { userId: user.id, canonicalHost: 'example.com', url: target, name: 'Trail Supply fixture', notificationLevel: 'FLAGS', notifyOnRecovery: true } }); projectId = project.id
    await control({ fixtureEnabled: true, broken: false })
    // This preconfigured Checkout is authorized only for the controlled no-order fixture.
    const outcome = await db.siteOutcome.create({ data: { projectId, name: 'Checkout', slug: 'checkout', kind: 'CHECKOUT', expectation: 'A customer can reach checkout from the product page.', criticality: 'CRITICAL', inferenceSource: 'user', confirmedAt: new Date(), bindings: { create: { key: 'checkout', mechanism: 'BROWSER_JOURNEY', required: true, config: { startUrl: target, safety: 'stop-at-checkout', steps: [{ action: 'click', role: 'link', name: 'Buy now' }], goal: { type: 'url_pattern', pattern: '/checkout' }, goalAfterStep: 1 }, scope: { pageUrl: target, device: 'mobile' } } } } })
    const run = async (label: string) => {
      const response = await page.request.post(`/api/sites/${projectId}/runs`, { headers: { 'Idempotency-Key': `reliability:${nonce}:${label}` }, data: { outcomeIds: [outcome.id] } })
      expect([200, 202], await response.text()).toContain(response.status()); return response.json()
    }
    const waitRun = async (runId: string, result: string) => {
      await expect.poll(async () => {
        const response = await page.request.get(`/api/sites/${projectId}/runs/${runId}`)
        if (!response.ok()) return `HTTP ${response.status()}`
        const value = await response.json(); return value.status === 'COMPLETED' ? value.result : value.status
      }, { timeout: 180000, intervals: [1500] }).toBe(result)
      return (await db.runRequest.findUnique({ where: { id: runId } }))!
    }
    const baseline = await run('baseline'); const baselineRecord = await waitRun(baseline.runId, 'CLEAR')
    proof.checkoutBaseline = { runId: baseline.runId, auditId: baselineRecord.auditId, result: 'CLEAR' }
    // Activate existing weekly monitoring; this also preserves the Checkout coverage.
    const activated = await page.request.post(`/api/sites/${projectId}/watch/activate`, { data: { interval: 'weekly' } })
    expect(activated.ok(), await activated.text()).toBe(true)
    const activation = await activated.json(); if (activation.runId) await waitRun(activation.runId, 'CLEAR')
    // Advance only this fixture's schedule; refuse to process other Sites.
    expect(await db.project.count({ where: { id: { not: projectId }, watchInterval: { not: null }, watchNextRunAt: { lte: new Date() } } })).toBe(0)
    await control({ broken: true, rejectNextEmail: true })
    await db.project.update({ where: { id: projectId }, data: { watchNextRunAt: new Date(0) } })
    // The isolated runtime owns scheduler invocation, rather than the shared worker.
    const scheduled = await page.request.post(`${runtime.fixtureOrigin}/tick`, { headers: { Authorization: `Bearer ${runtime.token}` }, data: { projectId } })
    expect(scheduled.ok(), await scheduled.text()).toBe(true)
    const watch = await scheduled.json(); const failedRecord = await waitRun(watch.runId, 'FLAG')
    await expect.poll(async () => (await db.audit.findUnique({ where: { id: failedRecord.auditId! } }))?.watchNotificationStatus).toBe('FAILED')
    const retried = await page.request.post(`${runtime.fixtureOrigin}/retry`, { headers: { Authorization: `Bearer ${runtime.token}` } })
    expect(retried.ok()).toBe(true)
    await expect.poll(async () => (await db.audit.findUnique({ where: { id: failedRecord.auditId! } }))?.watchNotificationStatus).toBe('SENT')
    const state = await control(); expect(state.messages).toHaveLength(1)
    expect(state.messages[0].to).toEqual([email])
    expect(state.messages[0].html).toContain('Reliability &lt;fixture&gt;')
    expect(state.messages[0].html).toContain(`/sites/${projectId}/flags/`)
    await writeFile(`${output}/notification.html`, state.messages[0].html)
    proof.notification = { transport: 'real Resend SDK to local controlled inbox', attempts: (await db.audit.findUnique({ where: { id: failedRecord.auditId! } }))!.watchNotificationAttempts, acceptedMessages: state.messages.length }
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
    await page.screenshot({ path: `${output}/desktop-flag.png`, fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: `${output}/mobile-flag.png`, fullPage: true })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const a11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    await writeFile(`${output}/accessibility.json`, JSON.stringify(a11y.violations, null, 2)); expect(a11y.violations).toEqual([])

    // Private, captured screenshot bytes: owner can read; strangers cannot.
    const audit = await db.audit.findUnique({ where: { id: failedRecord.auditId! }, include: { screenshots: true } })
    expect(audit!.isPublic).toBe(false); expect(audit!.screenshots.length).toBeGreaterThan(0)
    const shotPath = `/api/screenshots/${audit!.id}/desktop?page=p0`
    const shot = await page.request.get(shotPath); expect(shot.status()).toBe(200)
    expect(shot.headers()['cache-control']).toContain('private'); expect((await shot.body()).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    const stranger = await browser.newContext({ baseURL, ignoreHTTPSErrors: true })
    expect((await stranger.request.get(shotPath)).status()).toBe(403)
    expect((await stranger.request.get(`/api/sites/${projectId}`)).status()).not.toBe(200)
    await stranger.close()
    expect((await page.request.get(`${runtime.fixtureOrigin}/evidence/screenshots/${audit!.id}/p0-desktop.png`)).status()).toBe(403)
    proof.privateEvidence = 'actual worker capture -> signed S3 SDK PUT -> private object -> owner-authorized GET; anonymous Site/screenshot and unsigned object access denied'

    const verify = async () => {
      const response = await page.request.post(`/api/sites/${projectId}/flags/${flagId}/verify`, { data: {} })
      expect(response.status(), await response.text()).toBe(202); return response.json()
    }
    const unresolved = await verify(); await waitRun(unresolved.runId, 'FLAG')
    proof.unresolvedVerification = { runId: unresolved.runId, result: 'FLAG' }
    await control({ broken: false })
    const recovered = await verify(); const recoveredRecord = await waitRun(recovered.runId, 'CLEAR')
    const after = await (await page.request.get(`/api/sites/${projectId}`)).json()
    expect(after.outcomes.find((item: { id: string }) => item.id === outcome.id).state).toBe('CLEAR')
    await page.reload({ waitUntil: 'networkidle' }); await expect(page.getByText('Recovered', { exact: true }).first()).toBeVisible()
    await page.screenshot({ path: `${output}/mobile-recovery.png`, fullPage: true })
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.screenshot({ path: `${output}/desktop-recovery.png`, fullPage: true })
    proof.recovery = { runId: recovered.runId, auditId: recoveredRecord.auditId, result: 'CLEAR', customerStatus: 'Recovered' }
    const attempts = await db.outcomeBindingAttempt.findMany({ where: { outcomeId: outcome.id }, orderBy: { createdAt: 'asc' } })
    proof.bindingAttempts = attempts.map(({ auditId, disposition, reason, detail }) => ({ auditId, disposition, reason, detail }))
    proof.history = await db.improvementAttempt.findMany({ where: { improvement: { projectId, outcomeId: outcome.id } }, select: { outcome: true, comparable: true, verificationAuditId: true } })
    const final = await control(); proof.observedRequests = final.requests
    expect(final.requests.some((request: { path: string; status: number }) => request.path.endsWith('/checkout') && request.status === 503)).toBe(true)
    expect(final.requests.some((request: { path: string; status: number }) => request.path.endsWith('/checkout') && request.status === 200)).toBe(true)
    proof.continuedMonitoring = (await db.project.findUnique({ where: { id: projectId } }))!.watchNextRunAt
  } finally {
    await writeFile(`${output}/real-path-proof.json`, JSON.stringify(proof, null, 2))
    if (projectId) { await db.project.update({ where: { id: projectId }, data: { watchInterval: null, watchNextRunAt: null } }); await db.audit.deleteMany({ where: { projectId } }); await db.project.delete({ where: { id: projectId } }) }
    for (const id of auditIds) { await db.provisionalSite.deleteMany({ where: { primaryAuditId: id } }); await db.audit.deleteMany({ where: { id } }) }
    await db.user.delete({ where: { id: user.id } }); await db.$disconnect()
  }
})
