import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { listSiteOutcomes, loadSiteOutcomeDetail } from '@/lib/sites/outcomes'
import { claimAnonymousAudits } from '../claim-anonymous'
import { createAnonymousClaim, createAnonymousClaims } from '@/lib/security/anonymous-claim'
import * as sites from '@/lib/sites/ensure-site'
import * as ownedIdentity from '@/lib/improvements/owned-flag-identity'
import { loadSiteFindings } from '@/lib/sites/flags'
import { processDueProjectWatches } from '../project-watch'
import { fixedClock } from '@/lib/time/clock'
import { getAuditQueue } from '@/lib/queue/client'
import { getFlagDiffSummary, persistFlagDiffSummary } from '../diff-flags'
import { FLAG_COMPARISON_TARGET } from '../flag-comparison'
import { ensureDefaultMonitoring, MONITORING_SCHEDULE_UNAVAILABLE } from '@/lib/sites/application/default-monitoring'
import { removeSite } from '@/lib/sites/application/settings-commands'
import { productTransaction } from '@/lib/billing/product-transaction'
import * as betaPolicy from '@/lib/billing/beta-policy'
import { finalizeTriageDegraded } from '../finalize'
import { initializeUptimeMonitors } from '@/lib/uptime/service'
import { projectSiteAnalysis } from '@/lib/sites/application/project-analysis'

const cookies = vi.hoisted(() => ({ get: vi.fn(), delete: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: async () => cookies }))

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('anonymous claim with migrated PostgreSQL', () => {
  let userId: string, projectId: string, auditId: string, provisionalId: string
  const url = 'https://example.com/'
  const host = 'example.com'

  beforeAll(() => {
    const target = new URL(process.env.DATABASE_URL ?? '')
    if (!['localhost', '127.0.0.1'].includes(target.hostname) || !target.pathname.includes('test'))
      throw new Error('Claim integration requires a disposable local test database')
    vi.stubEnv('BETTER_AUTH_SECRET', 'local-claim-integration-secret-at-least-32-characters')
  })
  beforeEach(async () => {
    vi.clearAllMocks()
    userId = 'claim-test-' + randomUUID()
    await prisma.user.create({ data: { id: userId, email: userId + '@example.com', preferredTools: [] } })
    const project = await prisma.project.create({ data: { userId, name: 'Existing Site', url, canonicalHost: host } })
    projectId = project.id
    const audit = await prisma.audit.create({ data: { url, status: 'COMPLETED', skipUsageCount: true, aiReviewAt: new Date() } })
    auditId = audit.id
    const provisional = await prisma.provisionalSite.create({ data: { sessionKey: randomUUID(), url, canonicalHost: host, primaryAuditId: auditId } })
    provisionalId = provisional.id
    cookies.get.mockReturnValue({ value: createAnonymousClaim(auditId) })
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    await prisma.provisionalSite.delete({ where: { id: provisionalId } })
    await prisma.audit.deleteMany({ where: { id: auditId } })
    await prisma.user.delete({ where: { id: userId } })
  })
  afterAll(async () => {
    vi.unstubAllEnvs()
    const queue = getAuditQueue(), client = await queue.client
    await queue.close(); client.disconnect()
    await prisma.$disconnect()
  })

  async function collidingOutcomes() {
    const owned = await prisma.siteOutcome.create({ data: { projectId, slug: 'page-loads', name: 'Keep my homepage',
      kind: 'AVAILABILITY', inferenceSource: 'user', confirmedAt: new Date(),
      bindings: { create: { key: 'owned-availability', mechanism: 'HTTP_AVAILABILITY', config: { startUrl: url } } } } })
    const source = await prisma.siteOutcome.create({ data: { provisionalSiteId: provisionalId, slug: 'page-loads',
      name: 'Keep my pricing page', kind: 'AVAILABILITY', inferenceSource: 'user', confirmedAt: new Date(),
      bindings: { create: { key: 'pricing-availability', version: 3, mechanism: 'HTTP_AVAILABILITY', config: { startUrl: url + 'pricing' } } } },
      include: { bindings: true } })
    const execution = await prisma.outcomeBindingExecution.create({ data: { auditId, outcomeId: source.id,
      bindingKey: source.bindings[0].key, bindingVersion: 3, mechanism: 'HTTP_AVAILABILITY', disposition: 'FAILED', reason: 'http_unavailable' } })
    return { owned, source, execution }
  }

  it('restores public default monitoring when a signed claim explicitly restores the owned removed Site', async () => {
    await productTransaction(tx => ensureDefaultMonitoring(tx, projectId, userId))
    const outcome = await prisma.siteOutcome.findFirstOrThrow({ where: { projectId } })
    const lastRunAt = new Date(Date.now() - 86_400_000)
    await prisma.project.update({ where: { id: projectId }, data: { watchLastRunAt: lastRunAt } })
    await removeSite({ projectId, userId })
    expect(await claimAnonymousAudits(userId)).toBe(1)
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({ deletedAt: null, watchInterval: 'WEEKLY',
      watchNextRunAt: expect.any(Date), watchLastRunAt: lastRunAt, accountChecksEnabled: false })
    expect(await prisma.siteOutcome.findUniqueOrThrow({ where: { id: outcome.id } })).toMatchObject({ confirmedAt: outcome.confirmedAt })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toMatchObject({ userId, projectId })
    expect(await prisma.provisionalSite.findUniqueOrThrow({ where: { id: provisionalId } })).toMatchObject({ claimedProjectId: projectId })
    expect(cookies.delete).toHaveBeenCalledOnce()
  })

  it.each(['scheduled', 'analysis halted', 'paused'] as const)('claims an existing Site with %s monitoring intent', async mode => {
    if (mode === 'analysis halted') vi.spyOn(betaPolicy, 'hasOpenBetaAccess').mockReturnValue(false)
    const watchNextRunAt = mode === 'scheduled' ? new Date(Date.now() + 86_400_000) : null
    const watchPausedAt = mode === 'paused' ? new Date() : null
    const watchInterval = mode === 'analysis halted' ? 'DAILY' : 'WEEKLY'
    const watchLastError = mode === 'analysis halted' ? MONITORING_SCHEDULE_UNAVAILABLE : null
    await prisma.project.update({ where: { id: projectId }, data: { watchNextRunAt, watchPausedAt, watchInterval, watchLastError } })

    expect(await claimAnonymousAudits(userId)).toBe(1)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toMatchObject({ userId, projectId })
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({ watchNextRunAt, watchPausedAt, watchInterval, watchLastError })
    const monitor = await prisma.uptimeMonitor.findUnique({ where: { projectId } })
    if (mode === 'paused') expect(monitor).toBeNull()
    else expect(monitor).toMatchObject({ enabled: true, targetUrl: url, version: 1, lastCheckedAt: null })
    expect(await claimAnonymousAudits(userId)).toBe(1)
    expect(await prisma.uptimeMonitor.findUnique({ where: { projectId } })).toEqual(monitor)
  })

  it('refuses a previously claimed report after its linked Site changes owner', async () => {
    const foreignUserId = 'claim-foreign-' + randomUUID()
    await prisma.user.create({ data: { id: foreignUserId, email: foreignUserId + '@example.test', preferredTools: [] } })
    try {
      await prisma.audit.update({ where: { id: auditId }, data: { userId, projectId } })
      await prisma.project.update({ where: { id: projectId }, data: { userId: foreignUserId, deletedAt: new Date() } })
      const before = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
      await expect(claimAnonymousAudits(userId)).rejects.toThrow('Site is no longer owned by this account')
      expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toEqual(before)
      expect(await prisma.provisionalSite.findUniqueOrThrow({ where: { id: provisionalId } })).toMatchObject({ claimedProjectId: null })
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toMatchObject({ userId, projectId })
      expect(await prisma.siteOutcome.count({ where: { projectId } })).toBe(0)
      expect(cookies.delete).not.toHaveBeenCalled()
      // Once legitimate ownership is restored, the same retained proof can
      // finish the claim and default monitoring without losing identity.
      await prisma.project.update({ where: { id: projectId }, data: { userId, deletedAt: null } })
      expect(await claimAnonymousAudits(userId)).toBe(1)
      expect(await prisma.provisionalSite.findUniqueOrThrow({ where: { id: provisionalId } })).toMatchObject({ claimedProjectId: projectId })
      expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({ watchInterval: 'WEEKLY', watchNextRunAt: expect.any(Date) })
      expect(await prisma.siteOutcome.count({ where: { projectId } })).toBe(1)
    } finally {
      await prisma.project.update({ where: { id: projectId }, data: { userId, deletedAt: null } })
      await prisma.user.delete({ where: { id: foreignUserId } })
    }
  })

  it('retains the supplied public origin from anonymous admission through claim and automatic uptime setup', async () => {
    const target = 'http://www.example.com:8080/pricing'
    await prisma.project.delete({ where: { id: projectId } })
    await prisma.audit.update({ where: { id: auditId }, data: { url: target } })
    const provisional = await prisma.provisionalSite.findUniqueOrThrow({ where: { id: provisionalId } })
    const site = await sites.ensureSiteForAudit({ url: target, auditId, sessionKey: provisional.sessionKey })
    expect(site).toMatchObject({ canonicalHost: host, url: 'http://www.example.com:8080' })
    expect(await claimAnonymousAudits(userId)).toBe(1)
    const claimed = await sites.loadSiteRecord(site.siteId)
    expect(claimed).toMatchObject({ url: site.url, userId, canonicalHost: host })
    const coverage = await prisma.siteOutcome.findFirstOrThrow({ where: { projectId: claimed!.projectId }, include: { bindings: true } })
    expect(coverage.bindings[0].config).toEqual({ startUrl: site.url, expectedSelector: 'body' })
  })

  it.each(['existing owner context', 'owner edit after claim', 'unchanged claim replay'] as const)(
    'keeps Site context authoritative when handling %s', async scenario => {
      const contract = { purpose: 'Original report purpose', firstValueJourney: 'Open the original route',
        criticalOutcomes: ['Open the original page'], source: 'heuristic', inferredAt: new Date().toISOString() }
      const ownerContext = { purpose: 'Owner-edited purpose', firstValueJourney: 'Use the new entry page', criticalOutcomes: ['Reach pricing'],
        source: 'user', updatedAt: new Date().toISOString(), intentionalNotes: ['Use the new entry page'] }
      const editContext = () => prisma.project.update({ where: { id: projectId }, data: {
        productIntelligence: ownerContext, productIntelligenceRevision: { increment: 1 },
      } })
      await prisma.audit.update({ where: { id: auditId }, data: { productContract: contract, url: 'http://www.example.com:8080/pricing' } })
      if (scenario === 'existing owner context') await editContext()
      expect(await claimAnonymousAudits(userId)).toBe(1)
      const claimed = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
      expect(claimed.productIntelligence).toMatchObject(scenario === 'existing owner context' ? ownerContext : { purpose: contract.purpose })
      expect(claimed.productIntelligenceRevision).toBe(1)
      expect(claimed.url).toBe(url)
      const before = scenario === 'owner edit after claim' ? await editContext() : claimed
      expect(await claimAnonymousAudits(userId)).toBe(1)
      expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({
        productIntelligence: before.productIntelligence, productIntelligenceRevision: before.productIntelligenceRevision,
      })
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toMatchObject({ userId, projectId, productContract: contract })
    },
  )

  it('uses the newest admitted anonymous origin and context when claiming multiple reports for one Site', async () => {
    await prisma.project.delete({ where: { id: projectId } })
    const newestUrl = 'http://www.example.com:8080/pricing'
    const report = (purpose: string) => ({ purpose, firstValueJourney: 'Find pricing', criticalOutcomes: ['See pricing'], source: 'heuristic' })
    const older = await prisma.audit.update({ where: { id: auditId }, data: { productContract: report('Older report context') } })
    const newest = await prisma.audit.create({ data: { url: newestUrl, status: 'COMPLETED', skipUsageCount: true, aiReviewAt: new Date(),
      createdAt: new Date(older.createdAt.getTime() + 1000), productContract: report('Newest report context') } })
    try {
      const provisional = await prisma.provisionalSite.findUniqueOrThrow({ where: { id: provisionalId } })
      const site = await sites.ensureSiteForAudit({ url: newestUrl, auditId: newest.id, sessionKey: provisional.sessionKey })
      cookies.get.mockReturnValue({ value: createAnonymousClaims([older.id, newest.id]) })
      expect(await claimAnonymousAudits(userId)).toBe(2)
      const claimed = (await sites.loadSiteRecord(site.siteId))!
      expect(claimed).toMatchObject({ userId, url: site.url })
      expect(await prisma.audit.count({ where: { id: { in: [older.id, newest.id] }, userId, projectId: claimed.projectId } })).toBe(2)
      expect(await prisma.project.findUniqueOrThrow({ where: { id: claimed.projectId! } })).toMatchObject({
        productIntelligence: { purpose: 'Newest report context' }, productIntelligenceRevision: 1,
      })
      await initializeUptimeMonitors(undefined, 1, claimed.projectId!)
      expect(await prisma.uptimeMonitor.findUniqueOrThrow({ where: { projectId: claimed.projectId! } })).toMatchObject({
        targetUrl: new URL(site.url).href,
      })
    } finally { await prisma.audit.delete({ where: { id: newest.id } }) }
  })

  it('publishes pages and Outcomes under the owner when claim completes before projection writes', async () => {
    const signup = url + 'signup'
    await prisma.audit.update({ where: { id: auditId }, data: {
      executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', environment: 'production', targetUrl: url,
        checks: {}, outcomes: [], verificationTarget: null },
      pages: { create: { url, normalizedUrl: url, position: 0, role: 'primary', status: 'COMPLETED', title: 'Home' } },
      journeyReviews: { create: { journeyType: 'signup', startUrl: url, status: 'COMPLETED', steps: { create: {
        stepNumber: 1, actionType: 'navigate', actionDetail: {}, url: signup, accessibilityTree: '',
      } } } },
    } })
    const transact = prisma.$transaction.bind(prisma)
    const boundary = vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (write, options) => {
      expect(await claimAnonymousAudits(userId)).toBe(1)
      return transact(write, options)
    })
    try { await projectSiteAnalysis(auditId) }
    finally { boundary.mockRestore() }

    expect(await prisma.provisionalSite.findUniqueOrThrow({ where: { id: provisionalId } })).toMatchObject({ claimedProjectId: projectId })
    expect(await prisma.sitePage.count({ where: { provisionalSiteId: provisionalId } })).toBe(0)
    expect(await prisma.siteOutcome.count({ where: { provisionalSiteId: provisionalId } })).toBe(0)
    const owned = await prisma.siteOutcome.findUniqueOrThrow({ where: { projectId_slug: { projectId, slug: 'signup' } },
      include: { pages: { include: { page: true } } } })
    expect(owned.pages.map(link => link.page.url).sort()).toEqual([url, signup])
    expect(owned.pages.every(link => link.page.projectId === projectId)).toBe(true)
  })

  it('accounts for a Review claimed after finalization begins and before completion commits', async () => {
    await prisma.audit.update({ where: { id: auditId }, data: { status: 'FINALIZING', skipUsageCount: false } })
    const complete = prisma.audit.update.bind(prisma.audit)
    const boundary = vi.spyOn(prisma.audit, 'update').mockImplementation(async args => {
      if (args.where.id === auditId && args.data.status === 'COMPLETED') {
        expect(await claimAnonymousAudits(userId)).toBe(1)
        expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toMatchObject({ status: 'FINALIZING', userId, usageCountedAt: null })
      }
      return complete(args)
    })
    try {
      await finalizeTriageDegraded({ auditId, durationMs: 100, pagespeedCalls: 0, reason: 'unknown', errorMsg: 'Controlled incomplete collection',
        evidence: { desktopScreenshot: false, mobileScreenshot: false, metadata: false, desktopPageSpeed: false, mobilePageSpeed: false } })
    } finally { boundary.mockRestore() }

    const result = await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })
    expect(result).toMatchObject({ userId, projectId, status: 'COMPLETED', usageCountedAt: expect.any(Date) })
    expect(await prisma.provisionalSite.findUniqueOrThrow({ where: { id: provisionalId } })).toMatchObject({ claimedProjectId: projectId })
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).auditsUsed).toBe(1)
    expect(await claimAnonymousAudits(userId)).toBe(1)
    expect((await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).usageCountedAt).toEqual(result.usageCountedAt)
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).auditsUsed).toBe(1)
  })

  it('preserves completed anonymous comparison evidence through claiming and replay', async () => {
    const finding = await prisma.flag.create({ data: { auditId, source: 'DETERMINISTIC', rubric: 'EXPERIENCE', severity: 'IMPORTANT',
      checkId: 'fixture-claim-check', problem: 'Observed anonymous problem', evidence: 'Captured public evidence', whyItMatters: 'The page should work',
      fix: 'Resolve the observed issue', confidence: 1, position: 0, pageUrl: url } })
    await persistFlagDiffSummary(null, auditId)
    const before = await getFlagDiffSummary(null, auditId)
    const receipt = await prisma.auditVerificationReceipt.findFirstOrThrow({ where: { auditId, targetKey: FLAG_COMPARISON_TARGET } })
    expect(before.newIssues).toEqual([expect.objectContaining({ id: finding.id, status: 'OPEN' })])
    expect(await claimAnonymousAudits(userId)).toBe(1)
    await prisma.flag.update({ where: { id: finding.id }, data: { status: 'FIXED', resolvedInId: 'later-healthy-run' } })
    expect(await getFlagDiffSummary(null, auditId)).toEqual(before)
    expect(await prisma.auditVerificationReceipt.findUniqueOrThrow({ where: { id: receipt.id } })).toEqual(receipt)
    expect(await claimAnonymousAudits(userId)).toBe(1)
    expect(await getFlagDiffSummary(null, auditId)).toEqual(before)
  })

  // This sweeps all due Sites in its database. Run it in the focused disposable
  // scheduler invocation, independently of suites intentionally pausing work.
  it.skipIf(process.env.CLAIM_SCHEDULER_DB_REQUIRED !== 'true')('admits default production uptime from the real scheduler when the same Site has staging coverage', async () => {
    expect(await claimAnonymousAudits(userId)).toBe(1)
    const outcome = await prisma.siteOutcome.findFirstOrThrow({ where: { projectId, slug: 'page-loads' } })
    const staging = await prisma.siteOutcome.create({ data: { projectId, slug: 'staging-loads', name: 'Staging availability',
      kind: 'AVAILABILITY', environment: 'staging', confirmedAt: new Date(),
      bindings: { create: { key: 'staging-availability', mechanism: 'HTTP_AVAILABILITY', config: { startUrl: url + 'staging' } } } } })
    const now = new Date()
    expect(await processDueProjectWatches(20, { clock: fixedClock(now) })).toEqual({ processed: 1, enqueued: 1, errors: 0 })
    const request = await prisma.runRequest.findFirstOrThrow({ where: { projectId, source: 'WATCH' }, include: { selections: true, audit: true } })
    expect(request).toMatchObject({ environment: 'production', selections: [{ outcomeId: outcome.id }],
      audit: { projectId, userId, recheckTrigger: 'WATCH' } })
    expect(await prisma.siteOutcome.findUniqueOrThrow({ where: { id: staging.id } })).toEqual(staging)
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({ watchLastError: null,
      watchNextRunAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) })
  })

  it('preserves both Outcome identities, exact bindings, execution evidence and duplicate page links on claim and replay', async () => {
    const { owned, source, execution } = await collidingOutcomes()
    const page = await prisma.sitePage.create({ data: { projectId, url, path: '/' } })
    const provisionalPage = await prisma.sitePage.create({ data: { provisionalSiteId: provisionalId, url, path: '/' } })
    await prisma.siteOutcomePage.createMany({ data: [
      { outcomeId: owned.id, pageId: page.id }, { outcomeId: source.id, pageId: page.id },
      { outcomeId: source.id, pageId: provisionalPage.id },
    ] })

    const provisional = (await sites.loadSiteRecord('p_' + provisionalId))!
    expect((await listSiteOutcomes(provisional)).find(outcome => outcome.id === source.id))
      .toMatchObject({ pageIds: [provisionalPage.id], pageUrls: [url] })
    expect(await loadSiteOutcomeDetail(provisional, source.id)).toMatchObject({ pageIds: [provisionalPage.id], pageUrls: [url] })

    expect(await claimAnonymousAudits(userId)).toBe(1)
    const claimed = await prisma.siteOutcome.findUniqueOrThrow({ where: { id: source.id }, include: { bindings: true, pages: true, bindingExecutions: true } })
    expect(claimed).toMatchObject({ projectId, provisionalSiteId: null, name: source.name, confirmedAt: source.confirmedAt,
      kind: source.kind, bindings: source.bindings, bindingExecutions: [execution], pages: [{ outcomeId: source.id, pageId: page.id }] })
    expect(claimed.slug).not.toBe(owned.slug)
    expect(await prisma.siteOutcome.findUniqueOrThrow({ where: { id: owned.id } })).toEqual(owned)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toMatchObject({ userId, projectId })
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({ watchInterval: 'WEEKLY', watchNextRunAt: expect.any(Date) })
    expect(await sites.loadSiteRecord('p_' + provisionalId)).toMatchObject({ siteId: projectId, projectId, userId })
    expect((await listSiteOutcomes((await sites.loadSiteRecord(projectId))!)).find(outcome => outcome.id === source.id))
      .toMatchObject({ pageIds: [page.id], pageUrls: [url] })
    expect(await loadSiteOutcomeDetail((await sites.loadSiteRecord(projectId))!, source.id)).toMatchObject({ pageIds: [page.id], pageUrls: [url] })

    expect(await claimAnonymousAudits(userId)).toBe(1)
    expect(await prisma.siteOutcome.findUniqueOrThrow({ where: { id: source.id } })).toMatchObject({ slug: claimed.slug })
    expect(await prisma.siteOutcome.count({ where: { projectId } })).toBe(2)
    expect(await prisma.outcomeBindingExecution.findUniqueOrThrow({ where: { id: execution.id } })).toEqual(execution)
  })

  it('rolls back ownership, redirect, page and Outcome migration together when the claim is interrupted', async () => {
    const { source } = await collidingOutcomes()
    const page = await prisma.sitePage.create({ data: { provisionalSiteId: provisionalId, url: url + 'pricing', path: '/pricing' } })
    const migrate = sites.migrateProvisionalSiteDataToProject
    vi.spyOn(sites, 'migrateProvisionalSiteDataToProject').mockImplementationOnce(async (input, tx) => {
      await migrate(input, tx)
      throw new Error('Interrupted after migration')
    })
    await expect(claimAnonymousAudits(userId)).rejects.toThrow('Interrupted after migration')
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toMatchObject({ userId: null, projectId: null })
    expect(await prisma.provisionalSite.findUniqueOrThrow({ where: { id: provisionalId } })).toMatchObject({ claimedProjectId: null })
    expect(await prisma.siteOutcome.findUniqueOrThrow({ where: { id: source.id } })).toMatchObject({ projectId: null, provisionalSiteId: provisionalId, slug: source.slug })
    expect(await prisma.sitePage.findUniqueOrThrow({ where: { id: page.id } })).toMatchObject({ projectId: null, provisionalSiteId: provisionalId })
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({ watchInterval: null })
    expect(cookies.delete).not.toHaveBeenCalled()
    expect(await claimAnonymousAudits(userId)).toBe(1)
  })

  it('does not move another owner\'s already claimed provisional data even if its primary Audit matches', async () => {
    const foreignId = 'foreign-claim-' + randomUUID()
    let foreignProvisionalId: string | undefined
    try {
      await prisma.user.create({ data: { id: foreignId, email: foreignId + '@example.com', preferredTools: [] } })
      const foreignProject = await prisma.project.create({ data: { userId: foreignId, name: 'Foreign Site', url, canonicalHost: host } })
      const foreign = await prisma.provisionalSite.create({ data: { sessionKey: randomUUID(), canonicalHost: host, url,
        primaryAuditId: auditId, claimedProjectId: foreignProject.id,
        outcomes: { create: { slug: 'foreign', name: 'Foreign evidence' } } }, include: { outcomes: true } })
      foreignProvisionalId = foreign.id
      expect(await claimAnonymousAudits(userId)).toBe(1)
      expect(await prisma.provisionalSite.findUniqueOrThrow({ where: { id: foreign.id } })).toMatchObject({ claimedProjectId: foreignProject.id })
      expect(await prisma.siteOutcome.findUniqueOrThrow({ where: { id: foreign.outcomes[0].id } })).toMatchObject({ projectId: null, provisionalSiteId: foreign.id })
    } finally {
      if (foreignProvisionalId) await prisma.provisionalSite.delete({ where: { id: foreignProvisionalId } })
      await prisma.user.deleteMany({ where: { id: foreignId } })
    }
  })

  it('publishes durable Flag identity with the claim and preserves it on replay without inventing a handoff', async () => {
    const flag = await prisma.flag.create({ data: { auditId, checkId: 'buttons-no-text', source: 'DETERMINISTIC',
      rubric: 'EXPERIENCE', severity: 'IMPORTANT', problem: 'A button has no accessible name',
      evidence: 'The recorded action has no accessible name', fix: 'Give the existing button an aria-label.',
      whyItMatters: 'Its action is unclear', confidence: 1, pageUrl: url, position: 0 } })
    expect(await claimAnonymousAudits(userId)).toBe(1)
    const occurrence = await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: flag.id } })
    const site = await sites.loadSiteRecord(projectId)
    expect(site).toBeTruthy()
    expect((await loadSiteFindings(site!)).flags.find(item => item.sourceFlagId === flag.id)?.id).toBe(occurrence.improvementId)
    expect(await prisma.improvementCycleEvent.count({ where: { cycle: { projectId }, type: 'HANDOFF_COPIED' } })).toBe(0)
    await prisma.improvement.update({ where: { id: occurrence.improvementId }, data: { status: 'VERIFIED' } })
    expect(await claimAnonymousAudits(userId)).toBe(1)
    expect(await prisma.improvementOccurrence.count({ where: { flagId: flag.id } })).toBe(1)
    expect(await prisma.improvement.findUniqueOrThrow({ where: { id: occurrence.improvementId } })).toMatchObject({ status: 'VERIFIED' })
    expect(await prisma.improvementCycleEvent.count({ where: { idempotencyKey: 'generated:' + flag.id, type: 'GENERATED' } })).toBe(1)
  })

  it('rolls back the claim and retains the creator cookie when durable Flag publication fails', async () => {
    const flag = await prisma.flag.create({ data: { auditId, checkId: 'buttons-no-text', source: 'DETERMINISTIC',
      rubric: 'EXPERIENCE', severity: 'IMPORTANT', problem: 'An action has no name',
      evidence: 'Recorded action', fix: 'Name the action', whyItMatters: 'Its purpose is unclear', confidence: 1, position: 0 } })
    vi.spyOn(ownedIdentity, 'ensureOwnedFlagIdentities').mockRejectedValueOnce(new Error('Identity publication interrupted'))
    await expect(claimAnonymousAudits(userId)).rejects.toThrow('Identity publication interrupted')
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toMatchObject({ userId: null, projectId: null })
    expect(await prisma.provisionalSite.findUniqueOrThrow({ where: { id: provisionalId } })).toMatchObject({ claimedProjectId: null })
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({ watchInterval: null })
    expect(await prisma.improvementOccurrence.count({ where: { flagId: flag.id } })).toBe(0)
    expect(cookies.delete).not.toHaveBeenCalled()
  })

  it('claims every recorded observation across identity batches without duplicating or truncating history', async () => {
    await prisma.flag.createMany({ data: Array.from({ length: 501 }, (_, index) => ({ auditId,
      checkId: `buttons-no-text::page:${index}`, source: 'DETERMINISTIC' as const,
      rubric: 'EXPERIENCE' as const, severity: 'IMPORTANT' as const, problem: 'A button has no accessible name',
      evidence: 'Recorded button on page ' + index, fix: 'Name the existing action.', whyItMatters: 'Its purpose is unclear',
      confidence: 1, pageUrl: url + index, position: index })) })
    expect(await claimAnonymousAudits(userId)).toBe(1)
    expect(await prisma.improvement.count({ where: { projectId } })).toBe(1)
    expect(await prisma.improvementOccurrence.count({ where: { auditId } })).toBe(501)
    expect(await prisma.improvementCycleEvent.count({ where: { cycle: { projectId }, type: 'GENERATED' } })).toBe(501)
    expect(await claimAnonymousAudits(userId)).toBe(1)
    expect(await prisma.improvementOccurrence.count({ where: { auditId } })).toBe(501)
    expect(await prisma.improvementCycleEvent.count({ where: { cycle: { projectId }, type: 'GENERATED' } })).toBe(501)
    expect(await prisma.improvementCycleEvent.count({ where: { cycle: { projectId }, type: 'HANDOFF_COPIED' } })).toBe(0)
  })
})
