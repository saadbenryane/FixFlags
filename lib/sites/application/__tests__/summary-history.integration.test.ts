import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { Client } from 'pg'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { loadSiteSummaries, loadSiteNotificationSummaries } from '../list-sites'
import { loadSiteSummaryReferences } from '../summary-references'
import { includeLegacySiteAnalyses } from '../analysis-scope'
import { loadLegacySiteAnalysisIds } from '../legacy-analysis'
import { customerAttention } from '@/lib/sites/presentation'
import { siteSummariesSchema } from '@/lib/sites/summary-contract'

const run = process.env.DEFAULT_MONITORING_DB_REQUIRED === 'true' ? describe : describe.skip
run('account summaries with retained analysis history', () => {
  let userId: string, projectId: string
  const url = 'https://example.com/'
  beforeEach(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    userId = 'summary-history-' + randomUUID()
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test' } })
    const project = await prisma.project.create({ data: { userId, name: 'Summary history', url,
      canonicalHost: 'example.com', accountChecksEnabled: false, notificationLevel: 'OFF' } })
    projectId = project.id
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    await prisma.provisionalSite.deleteMany({ where: { claimedProjectId: projectId } })
    await prisma.audit.deleteMany({ where: { userId } })
    await prisma.user.deleteMany({ where: { id: userId } })
  })

  const spec = { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: url,
    environment: 'production', checks: {}, outcomes: [], verificationTarget: null }

  it('keeps confirmed uptime attention ahead of other work and retains ordinary Flags after recovery', async () => {
    const now = new Date()
    await prisma.project.update({ where: { id: projectId }, data: { watchInterval: 'WEEKLY', watchNextRunAt: new Date(now.getTime() + 86400_000) } })
    // Synthetic recorded observations exercise shared reads and ordering, not a
    // live outage, provider notification or executed website check.
    const monitor = await prisma.uptimeMonitor.create({ data: { projectId, targetUrl: url, state: 'offline',
      lastCheckedAt: now, nextProbeAt: new Date(now.getTime() + 300_000) } })
    const incident = await prisma.uptimeIncident.create({ data: { monitorId: monitor.id, version: 1, targetUrl: url,
      startedAt: now, confirmedAt: now, reason: 'response_error' } })
    const audit = await prisma.audit.create({ data: { projectId, userId, url, status: 'COMPLETED', completedAt: now, executionSpec: spec } })
    await prisma.flag.create({ data: { auditId: audit.id, source: 'DETERMINISTIC', rubric: 'REACH', severity: 'IMPORTANT',
      checkId: 'title-missing', problem: 'Page title is missing', evidence: 'The captured title is empty.',
      whyItMatters: 'Visitors cannot identify the page.', fix: 'Add a descriptive title.', pageUrl: url, confidence: 1, position: 0 } })
    const peer = await prisma.project.create({ data: { userId, name: 'Checking Site', url: 'https://second.example/', canonicalHost: 'second.example' } })
    await prisma.audit.create({ data: { projectId: peer.id, userId, url: peer.url, status: 'CHECKING', executionSpec: { ...spec, targetUrl: peer.url } } })
    const offline = siteSummariesSchema.parse(await loadSiteSummaries(userId))
    expect(offline[0].id).toBe(projectId)
    expect(offline[0].presentation.flags.count).toBe(1)
    expect(customerAttention(offline[0].presentation)).toEqual({ text: 'Offline', tone: 'attention' })
    await prisma.uptimeMonitor.update({ where: { id: monitor.id }, data: { lastCheckedAt: new Date(now.getTime() - 3600_000) } })
    const uncertain = siteSummariesSchema.parse(await loadSiteSummaries(userId))
    expect(uncertain[0].id).toBe(projectId)
    expect(customerAttention(uncertain[0].presentation)).toEqual({ text: 'Needs attention', tone: 'attention' })
    await prisma.uptimeIncident.update({ where: { id: incident.id }, data: { recoveredAt: new Date() } })
    await prisma.uptimeMonitor.update({ where: { id: monitor.id }, data: { state: 'online', lastCheckedAt: new Date() } })
    const recovered = siteSummariesSchema.parse(await loadSiteSummaries(userId))
    expect(recovered[0].id).toBe(peer.id)
    const retained = recovered.find(site => site.id === projectId)!
    expect(retained.presentation.flags.count).toBe(1)
    expect(retained.presentation.result.source).toBeUndefined()
    expect(customerAttention(retained.presentation)).toEqual({ text: '1 Flag', tone: 'attention' })
  })

  it('preserves snapshot, request and claimed-analysis authority before loading evidence', async () => {
    expect(await loadSiteSummaryReferences([])).toEqual([])
    const cases = [
      { name: 'snapshot', executionSpec: spec, expected: true },
      { name: 'request', request: { executionSpec: spec }, expected: true },
      { name: 'claimed', claimed: true, expected: true },
      { name: 'unscoped', expected: false },
      { name: 'category', executionSpec: { ...spec, scope: 'CATEGORY' }, expected: false },
      { name: 'setup', executionSpec: { ...spec, scope: 'FIXTURE_SETUP' }, claimed: true, expected: false },
      { name: 'claimed-target', claimed: true, request: { verificationTarget: { kind: 'DIAGNOSTIC', checkId: 'title-missing' } }, expected: false },
    ]
    for (const [index, scenario] of cases.entries()) {
      const audit = await prisma.audit.create({ data: { projectId, userId, url, status: 'COMPLETED',
        createdAt: new Date(2026, 0, index + 1), completedAt: new Date(2026, 0, index + 1),
        ...('executionSpec' in scenario ? { executionSpec: scenario.executionSpec } : {}) } })
      if (scenario.claimed) await prisma.provisionalSite.create({ data: { sessionKey: randomUUID(), canonicalHost: 'example.com',
        url, primaryAuditId: audit.id, claimedProjectId: projectId } })
      if (scenario.request) await prisma.runRequest.create({ data: { projectId, auditId: audit.id, source: 'WEB', status: 'COMPLETED',
        idempotencyKey: randomUUID(), ...scenario.request } })
      const previous = await prisma.audit.findFirst({ where: { projectId,
        ...includeLegacySiteAnalyses(await loadLegacySiteAnalysisIds([projectId])) }, orderBy: { createdAt: 'desc' }, select: { id: true } })
      const [selected] = await loadSiteSummaryReferences([projectId])
      expect(selected.latestAuditId, scenario.name).toBe(previous?.id ?? null)
      expect(selected.completedAuditId, scenario.name).toBe(previous?.id ?? null)
      if (scenario.expected) expect(selected.latestAuditId, scenario.name).toBe(audit.id)
      else expect(selected.latestAuditId, scenario.name).not.toBe(audit.id)
    }
    const latest = await prisma.audit.create({ data: { projectId, userId, url, status: 'CHECKING', executionSpec: spec,
      createdAt: new Date(2027, 0, 1) } })
    await prisma.screenshot.createMany({ data: [
      { id: 'a-' + randomUUID(), auditId: latest.id, device: 'DESKTOP', url: '/old-preview', width: 1280, height: 800 },
      { id: 'z-' + randomUUID(), auditId: latest.id, device: 'DESKTOP', url: '/selected-preview', width: 1280, height: 800 },
      { id: 'zz-' + randomUUID(), auditId: latest.id, device: 'MOBILE', url: '/mobile', width: 390, height: 844 },
    ] })
    const [selected] = await loadSiteSummaryReferences([projectId])
    expect(selected.latestAuditId).toBe(latest.id)
    expect(selected.completedAuditId).not.toBe(latest.id)
    const board = (await loadSiteSummaries(userId))[0]
    expect(board.presentation.run.state).toBe('running')
    expect(board.presentation.identity.preview?.url).toBe('/selected-preview')
    await prisma.screenshot.deleteMany({ where: { auditId: latest.id, device: 'DESKTOP' } })
    expect((await loadSiteSummaries(userId))[0].presentation.identity.preview).toBeNull()
    const peer = await prisma.project.create({ data: { userId, name: 'Second Site', url: 'https://second.example/',
      canonicalHost: 'second.example', accountChecksEnabled: false } })
    const peerAudit = await prisma.audit.create({ data: { projectId: peer.id, userId, url: peer.url,
      status: 'FAILED', executionSpec: { ...spec, targetUrl: peer.url }, createdAt: new Date(2028, 0, 1) } })
    const references = await loadSiteSummaryReferences([projectId, peer.id])
    expect(references).toEqual(expect.arrayContaining([
      expect.objectContaining({ projectId, latestAuditId: latest.id }),
      { projectId: peer.id, latestAuditId: peerAudit.id, completedAuditId: null, screenshotId: null },
    ]))
    const summaries = await loadSiteSummaries(userId)
    expect(summaries).toHaveLength(2)
    expect(summaries.find(site => site.id === projectId)?.presentation.run.state).toBe('running')
    expect(summaries.find(site => site.id === peer.id)?.presentation.run.state).toBe('failed')
  })

  it('bounds database transfer independently of old Audit payloads and preview count', async () => {
    const ids = Array.from({ length: 120 }, () => randomUUID())
    // These are retained synthetic observations, not executed website checks.
    await prisma.audit.createMany({ data: ids.map((id, index) => ({ id, userId, projectId, url, status: 'COMPLETED',
      executionSpec: spec, evidenceCoverage: { retainedContext: 'retained observations '.repeat(1024) },
      createdAt: new Date(2026, 0, 1, 0, index), completedAt: new Date(2026, 0, 1, 0, index) })) })
    await prisma.screenshot.createMany({ data: Array.from({ length: 120 }, (_, index) => ({
      id: String(index).padStart(3, '0') + randomUUID(), auditId: ids.at(-1)!, device: 'DESKTOP',
      url: '/preview-' + index, width: 1280, height: 800,
    })) })
    const oldScope = includeLegacySiteAnalyses([])
    const database = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] })
    const wire = new Client({ connectionString: process.env.DATABASE_URL })
    await wire.connect()
    const queries: Array<{ query: string; params: string }> = []
    database.$on('query', query => { if (query.query.startsWith('SELECT')) queries.push(query) })
    async function measure(legacy: boolean, notification = false) {
      queries.length = 0
      const audits = vi.spyOn(prisma.audit, 'findMany').mockImplementation(args => database.audit.findMany(legacy ? {
        ...args, where: { projectId, ...oldScope, ...(args?.where?.status ? { status: args.where.status } : {}) },
        orderBy: args?.where?.status ? { completedAt: 'desc' } : { createdAt: 'desc' }, distinct: ['projectId'],
      } : args))
      const shots = vi.spyOn(prisma.screenshot, 'findMany').mockImplementation(args => database.screenshot.findMany(legacy ? {
        ...args, where: { auditId: args?.where?.auditId, device: 'DESKTOP' },
      } : args))
      let summaries
      try { summaries = notification ? await loadSiteNotificationSummaries(userId) : await loadSiteSummaries(userId) }
      finally { audits.mockRestore(); shots.mockRestore() }
      let rows = 0, bytes = 0
      // Replay only the generated parameterized SELECTs to measure the rows
      // returned by PostgreSQL before Prisma's in-memory distinct processing.
      for (const query of queries.slice()) {
        // Prisma logs JSON scalar strings without their wire quotes. These
        // scope values belong to the legacy JSON predicate in this fixture.
        const parameters = JSON.parse(query.params).map((value: unknown) =>
          value === 'SITE' || value === 'FIXTURE_SETUP' ? JSON.stringify(value) : value)
        const result = await wire.query(query.query, parameters)
        rows += result.rows.length; bytes += Buffer.byteLength(JSON.stringify(result.rows))
      }
      return { summaries, rows, bytes }
    }
    try {
      const before = await measure(true), after = await measure(false), notification = await measure(false, true)
      expect(after.summaries).toEqual(before.summaries)
      expect(notification.summaries[0].presentation).toEqual(after.summaries[0].presentation)
      expect(after.summaries[0].presentation.identity.preview?.url).toBe('/preview-119')
      expect(after.rows).toBeLessThan(10)
      expect(after.bytes).toBeLessThan(before.bytes / 20)
      expect(notification.rows).toBe(after.rows)
      console.info('Summary database transfer:', { retainedAudits: ids.length, retainedPreviews: 120,
        before: { rows: before.rows, bytes: before.bytes }, after: { rows: after.rows, bytes: after.bytes } })
    } finally { await database.$disconnect(); await wire.end() }
    expect(await prisma.audit.count({ where: { projectId } })).toBe(ids.length)
    expect(await prisma.screenshot.count({ where: { auditId: ids.at(-1) } })).toBe(120)
  })
})
