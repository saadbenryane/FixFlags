import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { persistTechnologyObservations } from '@/lib/audit/technology-profile'
import { persistAuditGraphSnapshot } from '../snapshot'
import { persistAuditToGraph, reconcileSiteTechnologies } from '../persist'
import type { DetectedTech } from '@/lib/audit/tech-detect'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('technology profile publication authority', () => {
  const host = 'technology-' + randomUUID() + '.example.test', url = 'https://' + host + '/'
  const auditIds: string[] = [], provisionalIds: string[] = []
  let sequence = 0
  beforeAll(() => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
  })
  afterAll(async () => {
    await prisma.provisionalSite.deleteMany({ where: { id: { in: provisionalIds } } })
    await prisma.audit.deleteMany({ where: { id: { in: auditIds } } })
    await prisma.site.deleteMany({ where: { hostname: host } })
    await prisma.$disconnect()
  })
  async function publish(scope: string | null, technologies: DetectedTech[], status: 'COMPLETE' | 'PARTIAL' = 'COMPLETE', legacy = false) {
    const audit = await prisma.audit.create({ data: { url, status: 'COMPLETED', completedAt: new Date(Date.now() + ++sequence * 1000),
      executionSpec: scope ? { version: 1, scope } : Prisma.DbNull } })
    auditIds.push(audit.id)
    if (legacy) {
      const site = await prisma.provisionalSite.create({ data: { sessionKey: randomUUID(), canonicalHost: host, url, primaryAuditId: audit.id } })
      provisionalIds.push(site.id)
    }
    await persistTechnologyObservations(audit.id, technologies, status)
    await persistAuditGraphSnapshot(audit.id)
    return audit.id
  }
  const detected = (name: string, kind: DetectedTech['kind'] = 'framework'): DetectedTech => ({ name, kind, confidence: 0.82, evidence: [] })
  async function current() {
    return (await prisma.siteTechnology.findMany({ where: { site: { hostname: host }, isCurrent: true },
      select: { technology: { select: { name: true } } }, orderBy: { technology: { name: 'asc' } } })).map(item => item.technology.name)
  }
  it('retains legacy primary authority, excludes narrow runs, and never infers removals from partial evidence', async () => {
    await publish(null, [detected('Next.js')], 'COMPLETE', true)
    expect(await current()).toEqual(['Next.js'])
    await publish(null, [detected('React')])
    expect(await current()).toEqual(['Next.js'])
    const broad = await publish('SITE', [detected('Next.js')])
    for (const scope of ['DIAGNOSTIC', 'CATEGORY', 'FIXTURE_SETUP', 'ACCOUNT_CHECKS']) {
      await publish(scope, [detected('Plausible', 'analytics')])
      expect(await current()).toEqual(['Next.js'])
    }
    const partial = await publish('SITE', [detected('Plausible', 'analytics')], 'PARTIAL')
    expect(await current()).toEqual(['Next.js', 'Plausible'])
    await persistAuditGraphSnapshot(broad)
    expect(await current()).toEqual(['Next.js', 'Plausible'])
    const empty = await publish('SITE', [])
    expect(await current()).toEqual([])
    await Promise.all([persistAuditGraphSnapshot(broad), persistAuditGraphSnapshot(partial), persistAuditGraphSnapshot(empty)])
    expect(await current()).toEqual([])
  })
  it('rolls back deactivation and positive links together when publication is interrupted', async () => {
    await publish('SITE', [detected('React')])
    const site = await prisma.site.findUniqueOrThrow({ where: { hostname: host } })
    await expect(prisma.$transaction(async tx => {
      await reconcileSiteTechnologies(site.id, [detected('Plausible', 'analytics')], true, tx)
      throw new Error('Controlled interruption before commit')
    })).rejects.toThrow('Controlled interruption')
    expect(await current()).toEqual(['React'])
  })

  it('counts an Audit once when the same snapshot is published concurrently', async () => {
    const auditId = await publish('SITE', [detected('React')])
    const before = await prisma.site.findUniqueOrThrow({ where: { hostname: host } })
    await Promise.all([persistAuditGraphSnapshot(auditId), persistAuditGraphSnapshot(auditId)])
    expect(await prisma.site.findUniqueOrThrow({ where: { id: before.id } })).toMatchObject({ auditCount: before.auditCount })
  })

  it('rolls back graph links and counters when a late Flag write fails', async () => {
    const failedHost = 'interrupted-' + host, rootUrl = 'https://' + failedHost + '/'
    const audit = await prisma.audit.create({ data: { url: rootUrl, status: 'COMPLETED', completedAt: new Date() } })
    auditIds.push(audit.id)
    const fingerprint = randomUUID()
    try {
      await expect(persistAuditToGraph(audit.id, { rootUrl, pageUrls: [rootUrl], pageRoles: {}, detectedTech: [], industryGuess: null }, [{
        flagId: randomUUID(), checkId: 'title-missing', rubric: 'REACH', fingerprint, problem: 'Fixture issue', fix: 'Fixture fix', pageUrl: rootUrl,
        prompts: { generic: null, cursor: null, claude: null, windsurf: null, lovable: null, bolt: null },
      }])).rejects.toThrow()
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({ siteId: null })
      expect(await prisma.site.findUnique({ where: { hostname: failedHost } })).toBeNull()
      expect(await prisma.issue.findUnique({ where: { fingerprint } })).toBeNull()
    } finally {
      await prisma.site.deleteMany({ where: { hostname: failedHost } })
      await prisma.issue.deleteMany({ where: { fingerprint } })
    }
  })
})
