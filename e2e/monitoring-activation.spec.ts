import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { hashPassword } from 'better-auth/crypto'
import { randomBytes } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, writeFile, unlink } from 'node:fs/promises'
import { loadEnvConfig } from '@next/env'
import AxeBuilder from '@axe-core/playwright'
import { SITE_BOARD_COPY } from '../lib/marketing/copy/terminology'

test.use({ ignoreHTTPSErrors: true })

test('local real analysis, claim, activation and first independent execution', async ({ page, baseURL }) => {
  test.skip(process.env.FIXFLAGS_LOCAL_ACTIVATION_PROOF !== '1', 'Explicit local credentialed proof only')
  test.setTimeout(240_000)
  if (!baseURL || !['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname)) throw new Error('This fixture may only run locally')
  loadEnvConfig(process.cwd())
  if (!process.env.DATABASE_URL || !['127.0.0.1', 'localhost'].includes(new URL(process.env.DATABASE_URL).hostname)) throw new Error('Local database required')
  const db = new PrismaClient()
  const nonce = randomBytes(8).toString('hex')
  const email = `activation-${nonce}@example.invalid`, password = `Ff!${randomBytes(18).toString('base64url')}`
  const output = '.agents/artifacts/monitoring-activation'; await mkdir(output, { recursive: true })
  const proof: Record<string, unknown> = { environment: 'isolated local fixture runtime; notifications OFF; email delivery not tested' }
  const user = await db.user.create({ data: { email, name: 'Activation quality fixture', emailVerified: true } })
  await db.account.create({ data: { userId: user.id, accountId: user.id, providerId: 'credential', password: await hashPassword(password) } })
  let projectId: string | null = null
  let auditId: string | null = null
  let provisionalRecordId: string | null = null
  try {
    // Isolate the local fixture visitor; exercise existing limits without
    // spending or resetting the shared developer's anonymous allowance.
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': `2001:db8:${nonce.slice(0, 4)}:${nonce.slice(4, 8)}::1` })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/', { waitUntil: 'networkidle' })
    const field = page.getByRole('textbox', { name: 'Website URL' }).first(); await expect(field).toBeEnabled()
    const consent = page.getByRole('button', { name: 'Only necessary', exact: true }); if (await consent.isVisible()) await consent.click()
    await field.fill(`https://example.com/?fixflags-activation=${nonce}`)
    const submitted = page.waitForResponse(response => response.url().endsWith('/api/checks') && response.request().method() === 'POST')
    await page.getByRole('button', { name: 'Analyze', exact: true }).first().click()
    const created = await submitted; expect(created.ok(), 'Real URL submission accepted').toBe(true)
    const body = await created.json(); auditId = body.reportId
    expect(auditId).toBeTruthy(); const provisionalId = body.siteId as string
    provisionalRecordId = provisionalId.startsWith('p_') ? provisionalId.slice(2) : null
    await expect.poll(async () => (await db.audit.findUnique({ where: { id: auditId! }, select: { status: true } }))?.status, { timeout: 150_000, intervals: [1500] }).toBe('COMPLETED')
    proof.initialAnalysis = 'completed'
    await expect(page.getByRole('button', { name: 'Turn on monitoring' })).toBeEnabled({ timeout: 15000 })
    await page.getByRole('button', { name: 'Turn on monitoring' }).click()
    await expect(page.getByRole('dialog').getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', `/sign-up?next=${encodeURIComponent(`/sites/${provisionalId}`)}`)
    await page.keyboard.press('Escape')
    const signedIn = await page.request.post('/api/auth/sign-in/email', { headers: { Origin: baseURL }, data: { email, password } })
    expect(signedIn.ok(), 'Local fixture authentication').toBe(true)
    const claimed = await page.request.post('/api/me/claim'); expect(claimed.ok(), 'Existing claim command').toBe(true)
    const project = await db.project.findUnique({ where: { userId_canonicalHost: { userId: user.id, canonicalHost: 'example.com' } } })
    expect(project).toBeTruthy(); projectId = project!.id
    // No emails to a fixture recipient; keep actual notification behavior truthful.
    await db.project.update({ where: { id: projectId }, data: { notificationLevel: 'OFF' } })
    proof.claim = 'original analysis attached to owned Site'
    await page.goto(`/sites/${projectId}`, { waitUntil: 'networkidle' })
    await expect(page.getByRole('button', { name: 'Turn on monitoring' })).toBeEnabled()
    await page.getByRole('button', { name: 'Turn on monitoring' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('combobox')).toBeVisible()
    await expect(dialog.getByRole('option')).toHaveCount(1)
    await expect(dialog.getByRole('option')).toHaveText('Week')
    await dialog.screenshot({ path: `${output}/desktop-setup.png` })
    const activatedResponse = page.waitForResponse(response => response.url().endsWith('/watch/activate'))
    await dialog.getByRole('button', { name: 'Turn on monitoring' }).click()
    const activated = await (await activatedResponse).json()
    expect(activated).toMatchObject({ ok: true, interval: 'weekly', firstCheck: 'requested' })
    const persisted = await db.project.findUnique({ where: { id: projectId } })
    expect(persisted!.watchInterval).toBe('WEEKLY'); expect(persisted!.watchNextRunAt).toBeTruthy()
    const coverage = await db.siteOutcome.findFirst({ where: { projectId, slug: 'page-loads' }, include: { bindings: true } })
    expect(coverage!.confirmedAt).toBeTruthy(); expect(coverage!.enabled).toBe(true)
    expect(coverage!.bindings.some(binding => binding.enabled && binding.required && binding.mechanism === 'HTTP_AVAILABILITY')).toBe(true)
    proof.schedule = 'weekly, persisted with executable page coverage'
    await expect.poll(async () => (await db.outcomeAssessment.findFirst({ where: { outcomeId: coverage!.id }, orderBy: { assessedAt: 'desc' } }))?.state, { timeout: 150_000, intervals: [1500] }).toBe('CLEAR')
    await page.keyboard.press('Escape')
    await expect(page.getByText('This page opened when we checked.').first()).toBeVisible({ timeout: 15000 })
    proof.firstExecution = 'independent availability assessment CLEAR, reflected by the live overview'
    const before = await db.runRequest.count({ where: { projectId } })
    const repeated = await page.request.post(`/api/sites/${projectId}/watch/activate`, { data: { interval: 'weekly' } })
    expect(await repeated.json()).toMatchObject({ ok: true, reused: true })
    expect(await db.runRequest.count({ where: { projectId } })).toBe(before)
    expect((await db.project.findUnique({ where: { id: projectId } }))!.watchNextRunAt).toEqual(persisted!.watchNextRunAt)
    proof.repeatActivation = 'same run count and next scheduled time'
    // Advance only this disposable Site's due date; keep the real weekly policy.
    // Refuse the global adapter if another local Site is due, to protect others.
    const otherDue = await db.project.count({ where: { id: { not: projectId }, watchInterval: { not: null }, watchNextRunAt: { lte: new Date() } } })
    expect(otherDue, 'No unrelated Site may be processed by this fixture').toBe(0)
    await db.project.update({ where: { id: projectId }, data: { watchNextRunAt: new Date(0) } })
    // Run the existing adapter with the same TS runtime as the worker.
    await mkdir('.cache', { recursive: true })
    const tickScript = `.cache/activation-watch-${nonce}.ts`
    await writeFile(tickScript, `import { loadEnvConfig } from '@next/env'; loadEnvConfig(process.cwd());
      async function main() {
        const { prisma } = await import('../lib/db');
        const fixtureId = ${JSON.stringify(projectId)};
        const others = await prisma.project.count({ where: { id: { not: fixtureId }, watchInterval: { not: null }, watchNextRunAt: { lte: new Date() } } });
        if (others) throw new Error('Unrelated due Sites present');
        const { processDueProjectWatches } = await import('../lib/audit/project-watch');
        const result = await processDueProjectWatches(1);
        if (result.errors) throw new Error('Fixture Watch could not enqueue');
        await prisma.$disconnect(); process.exit(0);
      } main().catch(() => process.exit(1));`)
    try { await promisify(execFile)(process.execPath, ['node_modules/tsx/dist/cli.mjs', tickScript], { timeout: 30000 }) }
    finally { await unlink(tickScript) }

    await expect.poll(async () => (await db.runRequest.findFirst({ where: { projectId: projectId!, source: 'WATCH' }, orderBy: { requestedAt: 'desc' } }))?.status, { timeout: 150_000, intervals: [1500] }).toBe('COMPLETED')
    const scheduledRun = await db.runRequest.findFirst({ where: { projectId: projectId!, source: 'WATCH' }, orderBy: { requestedAt: 'desc' } })
    expect((await db.outcomeAssessment.findFirst({ where: { outcomeId: coverage!.id, runRequestId: scheduledRun!.id } }))?.state).toBe('CLEAR')
    proof.scheduledExecution = 'real due-Watch processor and worker completed; only the disposable due date was advanced'

    await page.keyboard.press('Escape'); await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByText('This page opened when we checked.').first()).toBeVisible()
    await page.screenshot({ path: `${output}/desktop-overview.png`, fullPage: true })
    const a11y = await new AxeBuilder({ page }).include('section[aria-label="Keep this website under watch."]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(a11y.violations).toEqual([])
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: 'Review coverage' }).focus(); await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog').getByRole('combobox')).toBeVisible()
    await page.getByRole('dialog').screenshot({ path: `${output}/mobile-coverage.png` })
    await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: 'Review coverage' })).toBeFocused()
    await page.getByRole('button', { name: 'Review coverage' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Add more checks' }).click()
    await expect(page.getByRole('dialog').getByRole('heading', { name: SITE_BOARD_COPY.addCard })).toBeVisible()
    await expect(page.getByRole('dialog').getByText('Checkout', { exact: true })).toBeVisible()
    await expect(page.getByRole('dialog').getByText('Safe Signup', { exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: SITE_BOARD_COPY.addCard, exact: true })).toBeFocused()
    proof.interactions = 'desktop/mobile coverage, keyboard, focus, scoped accessibility'
  } finally {
    await writeFile(`${output}/real-path-proof.json`, JSON.stringify(proof, null, 2))
    if (provisionalRecordId) await db.provisionalSite.deleteMany({ where: { id: provisionalRecordId } })
    if (projectId) {
      await db.project.update({ where: { id: projectId }, data: { watchInterval: null, watchNextRunAt: null } })
      await db.audit.deleteMany({ where: { projectId } })
      await db.project.delete({ where: { id: projectId } })
    }
    if (auditId) { await db.provisionalSite.deleteMany({ where: { primaryAuditId: auditId } }); await db.audit.deleteMany({ where: { id: auditId } }) }
    await db.user.delete({ where: { id: user.id } }); await db.$disconnect()
  }
})
