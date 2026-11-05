import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { ensureSiteForAudit } from '@/lib/sites/ensure-site'
import { confirmSiteOutcome, listSiteOutcomes, syncOutcomesFromAudit } from '@/lib/sites/outcomes'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { requestSiteRun } from '../run-requests'

vi.mock('@/lib/queue/client', () => ({ getAuditQueue: () => ({ add: async () => ({ id: 'controlled-outcome-admission' }) }) }))
vi.mock('@/lib/audit/ai-report-entitlement', () => ({ resolveIncludeAiForNewAudit: async () => false }))
vi.mock('node:dns/promises', () => ({ resolve4: async () => ['203.0.114.1'], resolve6: async () => [] }))

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('recorded Outcome projection under canonical Site identity', () => {
  let userId: string | undefined, projectId: string | undefined
  beforeAll(() => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
  })
  afterEach(async () => {
    if (projectId) await prisma.audit.deleteMany({ where: { projectId } })
    if (userId) await prisma.user.deleteMany({ where: { id: userId } })
    userId = undefined; projectId = undefined
  })
  afterAll(() => prisma.$disconnect())

  it.each(['apex', 'www'])('retains opposite-host pages, inference and owner binding intent for an existing %s Site', async host => {
    const siteUrl = host === 'apex' ? 'https://example.com/' : 'https://www.example.com/'
    const observedOrigin = host === 'apex' ? 'https://www.example.com' : 'https://example.com'
    const productUrl = observedOrigin + '/products/tote?color=blue#size'
    const signupUrl = observedOrigin + '/signup?plan=paid#enter'
    const foreignUrl = 'https://store.example.com/signup'
    userId = 'outcome-host-' + randomUUID()
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test', auditsLimit: 100 } })
    projectId = (await prisma.project.create({ data: { userId, name: 'Observed host identity fixture',
      url: siteUrl, canonicalHost: 'example.com' } })).id
    // Controlled recorded observations isolate projection and admission. They
    // do not represent a fresh browser visit or a completed purchase.
    const audit = await prisma.audit.create({ data: { userId, projectId, url: siteUrl, status: 'COMPLETED', completedAt: new Date(),
      executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: siteUrl, environment: 'production',
        monitoringPages: [siteUrl, productUrl], checks: {}, outcomes: [], verificationTarget: null },
      pages: { create: [{ url: siteUrl, normalizedUrl: siteUrl, position: 0, role: 'primary', status: 'COMPLETED', title: 'Store' },
        { url: productUrl, normalizedUrl: productUrl, position: 1, role: 'linked', status: 'COMPLETED', title: 'Tote' }] },
      journeyReviews: { create: { journeyType: 'signup', startUrl: siteUrl, status: 'COMPLETED', steps: { create: [
        { stepNumber: 1, actionType: 'navigate', actionDetail: {}, url: signupUrl, accessibilityTree: '' },
        { stepNumber: 2, actionType: 'navigate', actionDetail: {}, url: foreignUrl, accessibilityTree: '' },
      ] } } } } })
    const site = await ensureSiteForAudit({ url: productUrl, auditId: audit.id, userId })
    expect(site).toMatchObject({ projectId, url: siteUrl, canonicalHost: 'example.com' })
    await syncOutcomesFromAudit({ site, auditId: audit.id, url: siteUrl })
    const pages = await prisma.sitePage.findMany({ where: { projectId } })
    expect(new Set(pages.map(page => page.url))).toEqual(new Set([siteUrl, productUrl, signupUrl]))
    const checkout = await prisma.siteOutcome.findUniqueOrThrow({ where: { projectId_slug: { projectId, slug: 'checkout' } },
      include: { bindings: true } })
    expect(checkout).toMatchObject({ kind: 'CHECKOUT', inferenceSource: 'browser', confirmedAt: expect.any(Date),
      bindings: [{ version: 1, config: expect.objectContaining({ startUrl: productUrl, safety: 'stop-at-checkout' }) }] })
    const signup = (await listSiteOutcomes(site)).find(outcome => outcome.slug === 'signup')!
    expect(new Set(signup.pageUrls)).toEqual(new Set([siteUrl, signupUrl]))
    expect(signup.confirmedAt).toBeNull()
    expect(signup.bindings).toEqual([])

    const ownerStart = siteUrl + 'products/owner-choice?bundle=2#choose'
    await confirmSiteOutcome({ site, outcomeId: checkout.id, confirmed: true, kind: 'CHECKOUT', targetUrl: ownerStart })
    const binding = await prisma.outcomeExecutionBinding.findUniqueOrThrow({ where: { outcomeId_key: { outcomeId: checkout.id, key: 'checkout-browser-v1' } } })
    expect(binding).toMatchObject({ version: 2, config: expect.objectContaining({ startUrl: ownerStart }) })
    await syncOutcomesFromAudit({ site, auditId: audit.id, url: siteUrl })
    expect(await prisma.outcomeExecutionBinding.findUniqueOrThrow({ where: { id: binding.id } })).toEqual(binding)
    expect(new Set((await prisma.sitePage.findMany({ where: { projectId } })).map(page => page.id))).toEqual(new Set(pages.map(page => page.id)))
    const watch = await requestSiteRun({ projectId, userId, source: 'WATCH', scope: 'SITE', outcomeIds: [], idempotencyKey: randomUUID() })
    const admitted = readExecutionSpec((await prisma.runRequest.findUniqueOrThrow({ where: { id: watch.runId } })).executionSpec)!
    expect(admitted.monitoringPages).toContain(productUrl)
    expect(admitted.outcomes.find(outcome => outcome.id === checkout.id)?.bindings[0])
      .toMatchObject({ version: 2, config: { startUrl: ownerStart } })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toEqual(audit)
    expect(await prisma.project.count({ where: { userId } })).toBe(1)
  })
})
