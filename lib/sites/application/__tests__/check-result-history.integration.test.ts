import { createHash, randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { SiteRecord } from '@/lib/sites/types'

const fixture = vi.hoisted(() => ({ db: null as PrismaClient | null, reads: 0, fingerprints: 0,
  batches: [] as Array<{ bytes: number; count: number }> }))
const enabled = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true'
const cursorKey = 'disposable-check-history-signing-secret'
vi.mock('@/lib/db', async () => {
  if (process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED !== 'true') return { prisma: {} }
  const database = new URL(process.env.DATABASE_URL ?? '')
  if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
    throw new Error('Use the disposable execution verifier')
  const { PrismaClient } = await import('@prisma/client')
  fixture.db = new PrismaClient()
  return { prisma: fixture.db.$extends({ query: {get auditExecutionTask() { return this.auditVerifierExecution }, get auditVerificationReceipt() { return this.auditVerifierExecution },  async $queryRaw({ args, query }) {
    fixture.reads++
    const rows = await query(args)
    if (Array.isArray(rows) && rows.length === 1 && typeof rows[0]?.evidence === 'string') fixture.fingerprints++
    if (Array.isArray(rows) && rows.every(row => Object.hasOwn(row, 'detail'))) fixture.batches.push({ count: rows.length,
      bytes: rows.reduce((bytes, row) => bytes + Buffer.byteLength(JSON.stringify(row.detail)), 0) })
    return rows
  }, auditVerifierExecution: {
    async findMany({ args, query }) { fixture.reads++; return query(args) },
  } } }) }
})
import { loadSiteCheckResultPage } from '../check-results'
import { loadMonitoringHistory } from '../monitoring-history'
import { includeLegacySiteAnalyses } from '../analysis-scope'
import { siteViewFixture } from '../../__tests__/site-view-fixture'
import { readSiteHomeView } from '../../site-view-contract'
import { projectSiteBoard } from '../../board-view'

describe.skipIf(!enabled)('Recorded result history reads', () => {
  beforeEach(() => { vi.stubEnv('BETTER_AUTH_SECRET', cursorKey) })
  afterEach(() => { vi.unstubAllEnvs() })
  afterAll(async () => { await fixture.db?.$disconnect() })
  it('keeps a historical category observation accessible after responsibility ownership changes', async () => {
    const db = fixture.db!, identity = randomUUID()
    const user = await db.user.create({ data: { email: identity + '@result-history.example' } })
    try {
      const project = await db.project.create({ data: { userId: user.id, name: 'Preview history', canonicalHost: 'example.com', url: 'https://example.com/' } })
      const spec = { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: project.url, environment: 'production',
        checks: { 'corridor-og-title-drift': 2 }, outcomes: [], verificationTarget: null }
      const broad = await db.audit.create({ data: { userId: user.id, projectId: project.id, url: project.url, status: 'COMPLETED',
        createdAt: new Date('2026-10-01'), completedAt: new Date('2026-10-01T01:00:00Z'), executionSpec: spec } })
      const categories = []
      for (const [index, area] of ['conversion', 'search'].entries()) categories.push(await db.audit.create({ data: {
        userId: user.id, projectId: project.id, parentId: broad.id, url: project.url, status: 'COMPLETED',
        createdAt: new Date(Date.UTC(2026, 9, index + 2)), completedAt: new Date(Date.UTC(2026, 9, index + 2, 1)),
        executionSpec: { ...spec, scope: 'CATEGORY', category: { area, sourceAuditId: broad.id, pages: [project.url] } },
      } }))
      // Controlled stored observations exercise history selection, not webpage collection.
      for (const [index, audit] of [broad, ...categories].entries()) await db.auditVerificationReceipt.create({ data: {
        auditId: audit.id, targetKey: 'module:corridor', scopeKey: 'page:' + project.url, pageUrl: project.url,
        source: 'DETERMINISTIC', status: 'COMPLETED', updatedAt: audit.completedAt!, detail: {
          kind: 'site-module-check', version: 1, module: 'corridor', pageUrl: project.url, applicable: true, complete: true,
          passed: index === 2, assertions: [{ key: 'preview-titles', name: 'Distinct page preview titles', expected: 'Distinct titles',
            observed: index === 2 ? 'Distinct recorded titles' : 'Repeated recorded titles', passed: index === 2, complete: true }],
        },
      } })
      for (const [audit, targetKey, pageUrl] of [
        [categories[1], 'module:search-canonical', project.url],
        [broad, 'module:search', project.url],
        [categories[1], 'module:search-canonical', project.url + 'other'],
      ] as const) {
        const collectedAt = audit.completedAt!.toISOString()
        await db.auditVerificationReceipt.create({ data: {
          auditId: audit.id, targetKey, scopeKey: 'page:' + pageUrl, pageUrl, source: 'SEARCH', status: 'COMPLETED',
          detail: { kind: 'search-checks', version: 1, auditId: audit.id, pageUrl, collectedAt, complete: true,
            observations: [{ id: 'target', checkId: 'search-canonical-target', checkVersion: 5, responsibility: 'canonical',
              name: 'Canonical target', disposition: 'passed', reason: 'Reachable target', expected: 'A reachable target',
              observed: 'HTTP 200', source: 'http', collectedAt, pageUrl, evidence: [], limitation: '', guidance: '',
              attention: { policy: 'search', version: 5, kind: 'observation', reason: 'Reachable target' } }],
          },
        } })
      }
      const original = await db.auditVerificationReceipt.findMany({ where: { audit: { projectId: project.id } }, orderBy: { id: 'asc' } })
      const site = { siteId: project.id, kind: 'project', userId: user.id, projectId: project.id } as SiteRecord
      const filter = { area: 'search' as const, pageUrl: project.url }
      const current = await loadSiteCheckResultPage(site, broad, undefined, undefined, filter, true)
      expect(current.total).toBe(8)
      expect(current.results).toHaveLength(3)
      expect(current.results.find(result => result.search)).toMatchObject({ name: 'Canonical target', status: 'passed' })
      expect(current.results.every(result => result.auditId === categories[1].id && !result.historical)).toBe(true)
      const history = await loadSiteCheckResultPage(site, broad, current.nextCursor!, undefined, filter, true)
      expect(history.total).toBe(8)
      expect(history.results).toHaveLength(5)
      expect(history.results.find(result => result.search)).toMatchObject({ auditId: broad.id, name: 'Canonical target', historical: true })
      expect(history.nextCursor).toBeNull()
      expect(new Set(history.results.map(result => result.auditId))).toEqual(new Set([broad.id, categories[0].id]))
      expect(history.results.every(result => result.area === 'search' && result.historical)).toBe(true)
      expect(history.results.find(result => result.auditId === categories[0].id)?.checkedAt).toBe(categories[0].completedAt!.toISOString())
      expect(new Set([...current.results, ...history.results].map(result => result.id)).size).toBe(8)
      expect(await db.auditVerificationReceipt.findMany({ where: { audit: { projectId: project.id } }, orderBy: { id: 'asc' } })).toEqual(original)
    } finally { await db.user.delete({ where: { id: user.id } }) }
  })
  it('filters and counts Mobile layout observations by their recorded module version', async () => {
    const db = fixture.db!, identity = randomUUID()
    const user = await db.user.create({ data: { email: identity + '@result-history.example' } })
    try {
      const project = await db.project.create({ data: { userId: user.id, name: 'Mobile layout history', canonicalHost: 'example.com', url: 'https://example.com/' } })
      const recorded = []
      for (const [index, checkVersion] of [1, undefined, 2].entries()) {
        const collectedAt = new Date(Date.UTC(2026, 9, index + 1, 1))
        const audit = await db.audit.create({ data: { userId: user.id, projectId: project.id, url: project.url, status: 'COMPLETED',
          createdAt: new Date(Date.UTC(2026, 9, index + 1)), completedAt: collectedAt } })
        const receipt = await db.auditVerificationReceipt.create({ data: {
          auditId: audit.id, targetKey: 'module:mobile-ux-quality', scopeKey: 'page:' + project.url, pageUrl: project.url,
          source: 'DETERMINISTIC', status: 'COMPLETED', updatedAt: collectedAt, detail: {
            kind: 'site-module-check', version: 1, module: 'mobile-ux-quality', pageUrl: project.url,
            applicable: true, complete: true, passed: false,
            ...(checkVersion ? { execution: { auditId: audit.id, taskId: 'mobile-layout', checkVersion,
              source: 'rendered-dom', collectedAt: collectedAt.toISOString() } } : {}),
            assertions: [
              { key: 'mobile-input-fonts', name: 'Mobile input font size', expected: '16 px', observed: '12 px', passed: false, complete: true },
              { key: 'mobile-cta-position', name: 'Mobile action position', expected: 'Reachable', observed: 'Above the reach zone', passed: false, complete: true },
            ],
          },
        } })
        recorded.push({ audit, receipt, collectedAt })
      }
      const [original, unversioned, latest] = recorded
      const site = { siteId: project.id, kind: 'project', userId: user.id, projectId: project.id } as SiteRecord
      for (const [area, key] of [['accessibility', 'mobile-input-fonts'], ['conversion', 'mobile-cta-position']] as const) {
        const page = await loadSiteCheckResultPage(site, latest.audit, undefined, undefined, { area, pageUrl: project.url }, true)
        expect(page.total).toBe(1)
        expect(page.nextCursor).toBeNull()
        expect(page.results).toMatchObject([{ id: original.receipt.id + ':' + key, auditId: original.audit.id,
          area, historical: true, status: 'findings', checkedAt: original.collectedAt.toISOString(), source: 'rendered-dom',
          evidenceReference: { auditId: original.audit.id, executionId: original.receipt.id, pageUrl: project.url } }])
      }
      const performanceFilter = { area: 'performance' as const, pageUrl: project.url }
      const current = await loadSiteCheckResultPage(site, latest.audit, undefined, undefined, performanceFilter, true)
      expect(current.total).toBe(7)
      expect(current.results.map(result => result.auditId)).toEqual(Array(3).fill(latest.audit.id))
      expect(current.results.every(result => result.area === 'performance' && !result.historical)).toBe(true)
      expect(current.nextCursor).toBeTruthy()
      const history = await loadSiteCheckResultPage(site, latest.audit, current.nextCursor!, undefined, performanceFilter, true)
      expect(history.total).toBe(7)
      expect(history.nextCursor).toBeNull()
      expect(history.results.map(result => result.id)).toEqual([
        unversioned.receipt.id + ':mobile-input-fonts', unversioned.receipt.id + ':mobile-cta-position',
        unversioned.receipt.id, original.receipt.id,
      ])
      expect(history.results.every(result => result.area === 'performance' && result.historical)).toBe(true)
      const priorCursor = (area: 'performance' | 'security') => Buffer.from(JSON.stringify({
        version: 3, phase: 'history', receiptId: null, offset: 0,
        snapshot: createHash('sha256').update(JSON.stringify([
          'category-observation-history-v3', site.siteId, latest.audit.id, area, project.url, [],
        ])).digest('hex'),
      })).toString('base64url')
      await expect(loadSiteCheckResultPage(site, latest.audit, priorCursor('performance'), new Map(), performanceFilter))
        .rejects.toThrow('Invalid check history cursor')
      await expect(loadSiteCheckResultPage(site, latest.audit, priorCursor('security'), new Map(),
        { area: 'security', pageUrl: project.url })).rejects.toThrow('Invalid check history cursor')
      expect(await db.auditVerificationReceipt.findUnique({ where: { id: original.receipt.id } })).toEqual(original.receipt)
      const unrelated = await db.auditExecutionTask.create({ data: { auditId: latest.audit.id, targetKey: 'task:unrelated',
        source: 'SYSTEM', status: 'COMPLETED' } })
      await db.auditVerificationReceipt.update({ where: { id: latest.receipt.id },
        data: { taskId: unrelated.id, updatedAt: latest.receipt.updatedAt } })
      await expect(loadSiteCheckResultPage(site, latest.audit, current.nextCursor!, undefined, performanceFilter, true))
        .rejects.toThrow('Check evidence selection changed')
      const refreshed = await loadSiteCheckResultPage(site, latest.audit, undefined, undefined, performanceFilter, true)
      expect(refreshed.total).toBe(5)
      expect(refreshed.results).toMatchObject([{ id: latest.receipt.id, status: 'unknown', kind: 'execution' }])
    } finally { await db.user.delete({ where: { id: user.id } }) }
  })
  it('reads completed collection and limited coverage separately from PostgreSQL through the Timeline contract', async () => {
    const db = fixture.db!, identity = randomUUID()
    const user = await db.user.create({ data: { email: identity + '@result-history.example' } })
    try {
      const project = await db.project.create({ data: { userId: user.id, name: 'Limited coverage', canonicalHost: 'example.com', url: 'https://example.com/' } })
      const audit = await db.audit.create({ data: { userId: user.id, projectId: project.id, url: project.url,
        status: 'COMPLETED', reportCompleteness: 'PARTIAL', failedModules: ['flow'], completedAt: new Date(),
        evidenceCoverage: { metadata: true, desktopScreenshot: true } } })
      const site = { siteId: project.id, kind: 'project', userId: user.id, projectId: project.id } as SiteRecord
      const history = await loadMonitoringHistory(site, { legacyIds: [audit.id], where: includeLegacySiteAnalyses([audit.id]) })
      expect(history.timeline).toHaveLength(1)
      expect(history.timeline[0]).toMatchObject({ executionState: 'COMPLETED', completionState: 'PARTIAL' })
      const view = siteViewFixture(); view.monitoringHistory = history.timeline; view.monitoringTrend = history.trend
      const parsed = readSiteHomeView(JSON.parse(JSON.stringify(view)), view.site.siteId)
      const board = projectSiteBoard(parsed, view.site.siteId, true, false, null)
      expect(board.timelineEvents[0]).toMatchObject({ title: 'Check completed', state: 'unknown' })
      expect(board.monitoringPoints[0].flagCount).toBeNull()
      await db.audit.update({ where: { id: audit.id }, data: { failedModules: ['browser'] } })
      expect((await loadMonitoringHistory(site, { legacyIds: [audit.id], where: includeLegacySiteAnalyses([audit.id]) })).timeline[0])
        .toMatchObject({ executionState: 'PARTIAL', completionState: 'PARTIAL' })
    } finally { await db.user.delete({ where: { id: user.id } }) }
  })

  it('counts accumulated monitoring evidence with bounded database round trips and retains exact snapshot fencing', async () => {
    const db = fixture.db!, identity = randomUUID()
    const user = await db.user.create({ data: { email: identity + '@result-history.example' } })
    try {
      const project = await db.project.create({ data: { userId: user.id, name: 'Recorded history', canonicalHost: 'example.com', url: 'https://example.com/' } })
      const audits = []
      for (let index = 0; index < 25; index++) {
        audits.push(await db.audit.create({ data: { userId: user.id, projectId: project.id, url: project.url, status: 'COMPLETED',
          createdAt: new Date(Date.UTC(2026, 0, index + 1)), completedAt: new Date(Date.UTC(2026, 0, index + 1, 1)) } }))
      }
      const detail = { kind: 'site-module-check', version: 1, module: 'metadata', applicable: true, passed: true, complete: true,
        pageUrl: project.url, assertions: [{ key: 'title-presence', name: 'Page title', expected: 'A title is declared', observed: 'A title was recorded', passed: true, complete: true }] }
      await db.auditVerificationReceipt.createMany({ data: audits.flatMap(audit => Array.from({ length: 20 }, (_, index) => ({
        auditId: audit.id, targetKey: 'module:metadata', scopeKey: 'page:' + index, pageUrl: project.url + 'page-' + index,
        source: 'DETERMINISTIC', status: 'COMPLETED' as const, detail: { ...detail, pageUrl: project.url + 'page-' + index },
      }))) })
      const site = { siteId: project.id, kind: 'project', userId: user.id, projectId: project.id } as SiteRecord
      const latest = audits.at(-1)!.id, filter = { area: 'search' as const }
      fixture.reads = 0
      const started = performance.now()
      vi.stubEnv('BETTER_AUTH_SECRET', '')
      const page = await loadSiteCheckResultPage(site, latest, undefined, new Map(), filter, true)
      vi.stubEnv('BETTER_AUTH_SECRET', cursorKey)
      process.stdout.write(`History proof: 500 receipts, ${fixture.reads} receipt reads, ${Math.round(performance.now() - started)} ms\n`)
      expect(page.total).toBe(1000)
      expect(page.results).toHaveLength(40)
      expect(page.results.every(result => !result.historical)).toBe(true)
      expect(page.nextCursor).toBeTruthy()
      expect(fixture.reads).toBeLessThanOrEqual(20)
      const previousFingerprint = createHash('sha256')
      for (const phase of ['current', 'history'] as const) {
        const rows = await db.auditVerificationReceipt.findMany({ where: { audit: { projectId: project.id },
          targetKey: { startsWith: 'module:' }, auditId: phase === 'current' ? audits.at(-1)!.id : { not: audits.at(-1)!.id } },
          orderBy: [{ audit: { createdAt: 'desc' } }, { createdAt: 'desc' }, { id: 'desc' }],
          select: { id: true, auditId: true, targetKey: true, pageUrl: true, source: true, status: true, detail: true, taskId: true, updatedAt: true } })
        for (const row of rows) previousFingerprint.update(JSON.stringify([phase, row.id, row.auditId, row.targetKey, row.pageUrl,
          row.source, row.status, row.updatedAt.toISOString(), row.detail, row.taskId]))
      }
      expect(JSON.parse(Buffer.from(page.nextCursor!, 'base64url').toString())).toMatchObject({
        version: 4, evidence: previousFingerprint.digest('hex'),
      })
      const upgraded = await loadSiteCheckResultPage(site, latest, page.nextCursor!, new Map(), filter, true)
      const signed = JSON.parse(Buffer.from(upgraded.nextCursor!, 'base64url').toString())
      expect(signed).toMatchObject({ version: 5, total: 1000, remaining: 860 })
      const forged = Buffer.from(JSON.stringify({ ...signed, total: 1200 })).toString('base64url')
      await expect(loadSiteCheckResultPage(site, latest, forged, new Map(), filter, true)).rejects.toThrow('Invalid check history cursor')
      await expect(loadSiteCheckResultPage(site, latest, upgraded.nextCursor!, new Map(), { ...filter, pageUrl: project.url }, true))
        .rejects.toThrow('Invalid check history cursor')

      fixture.batches = []
      fixture.fingerprints = 0
      const ids = new Set([...page.results, ...upgraded.results].map(result => result.id))
      let cursor = upgraded.nextCursor
      while (cursor) {
        const continuation = await loadSiteCheckResultPage(site, latest, cursor, new Map(), filter, true)
        expect(continuation.total).toBe(1000)
        expect(continuation.results.length).toBeGreaterThan(0)
        for (const result of continuation.results) {
          expect(ids.has(result.id)).toBe(false)
          ids.add(result.id)
        }
        cursor = continuation.nextCursor
      }
      expect(ids.size).toBe(1000)
      expect(fixture.fingerprints).toBe(9)
      expect(fixture.batches).toEqual([])
      const oldest = await db.auditVerifierExecution.findFirstOrThrow({ where: { auditId: audits[0].id } })
      await db.auditVerificationReceipt.update({ where: { id: oldest.id }, data: { updatedAt: oldest.updatedAt,
        detail: { ...detail, pageUrl: oldest.pageUrl!, assertions: [{ ...detail.assertions[0], observed: 'A changed historical observation' }] } } })
      await expect(loadSiteCheckResultPage(site, latest, upgraded.nextCursor!, new Map(), filter, true))
        .rejects.toThrow('Check evidence selection changed')
      await expect(loadSiteCheckResultPage(site, latest, page.nextCursor!, new Map(), filter, true))
        .rejects.toThrow('Check evidence selection changed')
    } finally { await db.user.delete({ where: { id: user.id } }) }
  }, 30_000)

  it('processes oversized receipts individually and continues after each short byte-bounded batch', async () => {
    const db = fixture.db!, identity = randomUUID()
    const user = await db.user.create({ data: { email: identity + '@result-history.example' } })
    try {
      const project = await db.project.create({ data: { userId: user.id, name: 'Dense evidence', canonicalHost: 'example.com', url: 'https://example.com/' } })
      const audit = await db.audit.create({ data: { userId: user.id, projectId: project.id, url: project.url, status: 'COMPLETED', completedAt: new Date() } })
      for (let index = 0; index < 3; index++) {
        const pageUrl = project.url + 'page-' + index
        await db.auditVerificationReceipt.create({ data: { auditId: audit.id, targetKey: 'module:metadata', scopeKey: 'page:' + index,
          pageUrl, source: 'DETERMINISTIC', status: 'COMPLETED', detail: {
            kind: 'site-module-check', version: 1, module: 'metadata', applicable: true, passed: true, complete: true, pageUrl,
            assertions: Array.from({ length: 180 }, (_, assertion) => ({ key: 'title-presence', name: 'Page title',
              expected: 'A title is declared', observed: 'Recorded '.repeat(220), context: assertion + ':' + 'x'.repeat(3900), passed: true, complete: true })),
          } } })
      }
      fixture.batches = []
      const page = await loadSiteCheckResultPage({ siteId: project.id, kind: 'project', userId: user.id, projectId: project.id } as SiteRecord, audit.id,
        undefined, new Map(), { area: 'search' }, true)
      expect(page.results).toHaveLength(100)
      expect(page.total).toBe(543)
      expect(page.nextCursor).toBeTruthy()
      expect(fixture.batches.some(batch => batch.bytes > 1024 * 1024)).toBe(true)
      expect(fixture.batches.every(batch => batch.bytes <= 1024 * 1024 || batch.count === 1)).toBe(true)
    } finally { await db.user.delete({ where: { id: user.id } }) }
  }, 30_000)

  it('keeps Site, category, page and provisional report filters aligned with the visible result projection', async () => {
    const db = fixture.db!, identity = randomUUID()
    const user = await db.user.create({ data: { email: identity + '@result-history.example' } })
    let anonymousId: string | null = null
    try {
      const projects = await Promise.all(['example.com', 'other.example'].map(host => db.project.create({ data: {
        userId: user.id, name: host, canonicalHost: host, url: 'https://' + host + '/',
      } })))
      const audits = await Promise.all([
        { projectId: projects[0].id, url: projects[0].url + 'broad' },
        { projectId: projects[0].id, url: projects[0].url + 'category' },
        { projectId: projects[1].id, url: projects[1].url },
      ].map(scope => db.audit.create({ data: { ...scope, userId: user.id, status: 'COMPLETED', completedAt: new Date() } })))
      const anonymous = await db.audit.create({ data: { url: 'https://provisional.example/', isPublic: true, status: 'COMPLETED', completedAt: new Date() } })
      anonymousId = anonymous.id
      for (const audit of [...audits, anonymous]) {
        await db.auditVerificationReceipt.create({ data: { auditId: audit.id, targetKey: 'module:metadata', scopeKey: 'page:' + audit.url,
          pageUrl: audit.url, source: 'DETERMINISTIC', status: 'COMPLETED', detail: {
            kind: 'site-module-check', version: 1, module: 'metadata', pageUrl: audit.url, applicable: true, passed: true, complete: true,
            assertions: [{ key: 'title-presence', name: 'Page title', expected: 'A title is declared', observed: 'Recorded title', passed: true, complete: true }],
          } } })
      }
      const site = { siteId: projects[0].id, kind: 'project', userId: user.id, projectId: projects[0].id } as SiteRecord
      const categories = new Map([['search', { id: audits[1].id }]]) as never
      const current = await loadSiteCheckResultPage(site, audits[0].id, undefined, categories, { area: 'search' }, true)
      expect(current.total).toBe(4)
      expect(current.results).toHaveLength(2)
      expect(current.results.every(result => result.auditId === audits[1].id && !result.historical)).toBe(true)
      const history = await loadSiteCheckResultPage(site, audits[0].id, current.nextCursor!, categories, { area: 'search' }, true)
      expect(history.total).toBe(4)
      expect(history.results).toHaveLength(2)
      expect(history.results.every(result => result.auditId === audits[0].id && result.historical)).toBe(true)
      const page = await loadSiteCheckResultPage(site, audits[0].id, undefined, categories, { area: 'search', pageUrl: audits[1].url }, true)
      expect(page.total).toBe(2)
      expect(page.nextCursor).toBeNull()
      const provisional = await loadSiteCheckResultPage({ siteId: 'p_' + anonymous.id, primaryAuditId: anonymous.id } as SiteRecord,
        anonymous.id, undefined, new Map(), {}, true)
      expect(provisional.total).toBe(2)
      expect(provisional.results.every(result => result.auditId === anonymous.id)).toBe(true)
    } finally {
      if (anonymousId) await db.audit.delete({ where: { id: anonymousId } })
      await db.user.delete({ where: { id: user.id } })
    }
  }, 30_000)
})
