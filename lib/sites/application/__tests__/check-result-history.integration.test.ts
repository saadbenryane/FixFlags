import { createHash, randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { SiteRecord } from '@/lib/sites/types'

const fixture = vi.hoisted(() => ({ db: null as PrismaClient | null, reads: 0, batches: [] as Array<{ bytes: number; count: number }> }))
const enabled = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true'
vi.mock('@/lib/db', async () => {
  if (process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED !== 'true') return { prisma: {} }
  const database = new URL(process.env.DATABASE_URL ?? '')
  if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
    throw new Error('Use the disposable execution verifier')
  const { PrismaClient } = await import('@prisma/client')
  fixture.db = new PrismaClient()
  return { prisma: fixture.db.$extends({ query: { async $queryRaw({ args, query }) {
    fixture.reads++
    const rows = await query(args)
    if (Array.isArray(rows)) fixture.batches.push({ count: rows.length,
      bytes: rows.reduce((bytes, row) => bytes + Buffer.byteLength(JSON.stringify(row.detail)), 0) })
    return rows
  }, auditVerifierExecution: {
    async findMany({ args, query }) { fixture.reads++; return query(args) },
  } } }) }
})
import { loadSiteCheckResultPage } from '../check-results'

describe.skipIf(!enabled)('Recorded result history reads', () => {
  afterAll(async () => { await fixture.db?.$disconnect() })
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
      await db.auditVerifierExecution.createMany({ data: audits.flatMap(audit => Array.from({ length: 20 }, (_, index) => ({
        auditId: audit.id, targetKey: 'module:metadata', scopeKey: 'page:' + index, pageUrl: project.url + 'page-' + index,
        source: 'DETERMINISTIC', status: 'COMPLETED' as const, detail: { ...detail, pageUrl: project.url + 'page-' + index },
      }))) })
      const site = { siteId: project.id, projectId: project.id } as SiteRecord
      fixture.reads = 0
      const started = performance.now()
      const page = await loadSiteCheckResultPage(site, audits.at(-1)!.id, undefined, new Map(), { area: 'search' }, true)
      process.stdout.write(`History proof: 500 receipts, ${fixture.reads} receipt reads, ${Math.round(performance.now() - started)} ms\n`)
      expect(page.total).toBe(1000)
      expect(page.results).toHaveLength(40)
      expect(page.results.every(result => !result.historical)).toBe(true)
      expect(page.nextCursor).toBeTruthy()
      expect(fixture.reads).toBeLessThanOrEqual(20)
      const previousFingerprint = createHash('sha256')
      for (const phase of ['current', 'history'] as const) {
        const rows = await db.auditVerifierExecution.findMany({ where: { audit: { projectId: project.id },
          targetKey: { startsWith: 'module:' }, auditId: phase === 'current' ? audits.at(-1)!.id : { not: audits.at(-1)!.id } },
          orderBy: [{ audit: { createdAt: 'desc' } }, { createdAt: 'desc' }, { id: 'desc' }],
          select: { id: true, auditId: true, targetKey: true, pageUrl: true, source: true, status: true, detail: true, updatedAt: true } })
        for (const row of rows) previousFingerprint.update(JSON.stringify([phase, row.id, row.auditId, row.targetKey, row.pageUrl,
          row.source, row.status, row.updatedAt.toISOString(), row.detail]))
      }
      expect(JSON.parse(Buffer.from(page.nextCursor!, 'base64url').toString()).evidence).toBe(previousFingerprint.digest('hex'))
      const oldest = await db.auditVerifierExecution.findFirstOrThrow({ where: { auditId: audits[0].id } })
      await db.auditVerifierExecution.update({ where: { id: oldest.id }, data: { updatedAt: oldest.updatedAt,
        detail: { ...detail, pageUrl: oldest.pageUrl!, assertions: [{ ...detail.assertions[0], observed: 'A changed historical observation' }] } } })
      await expect(loadSiteCheckResultPage(site, audits.at(-1)!.id, page.nextCursor!, new Map(), { area: 'search' }, true))
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
        await db.auditVerifierExecution.create({ data: { auditId: audit.id, targetKey: 'module:metadata', scopeKey: 'page:' + index,
          pageUrl, source: 'DETERMINISTIC', status: 'COMPLETED', detail: {
            kind: 'site-module-check', version: 1, module: 'metadata', applicable: true, passed: true, complete: true, pageUrl,
            assertions: Array.from({ length: 180 }, (_, assertion) => ({ key: 'title-presence', name: 'Page title',
              expected: 'A title is declared', observed: 'Recorded '.repeat(220), context: assertion + ':' + 'x'.repeat(3900), passed: true, complete: true })),
          } } })
      }
      fixture.batches = []
      const page = await loadSiteCheckResultPage({ siteId: project.id, projectId: project.id } as SiteRecord, audit.id,
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
        await db.auditVerifierExecution.create({ data: { auditId: audit.id, targetKey: 'module:metadata', scopeKey: 'page:' + audit.url,
          pageUrl: audit.url, source: 'DETERMINISTIC', status: 'COMPLETED', detail: {
            kind: 'site-module-check', version: 1, module: 'metadata', pageUrl: audit.url, applicable: true, passed: true, complete: true,
            assertions: [{ key: 'title-presence', name: 'Page title', expected: 'A title is declared', observed: 'Recorded title', passed: true, complete: true }],
          } } })
      }
      const site = { siteId: projects[0].id, projectId: projects[0].id } as SiteRecord
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
