import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'

const { fixture } = vi.hoisted(() => ({ fixture: { db: null as unknown as PrismaClient, schema: '' } }))
vi.mock('@/lib/db', () => ({ prisma: new Proxy({}, { get: (_target, key) => {
  if (key === '$transaction') return async (run: (tx: unknown) => unknown) => fixture.db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${fixture.schema}"`)
    return run(tx)
  })
  return fixture.db[key as keyof PrismaClient]
} }) }))
import { loadResearchConsent, saveResearchConsent } from '../research-consent'
import { hasCurrentResearchPermissions, RESEARCH_PERMISSIONS_KIND, RESEARCH_PERMISSIONS_PATH } from '../research-permissions'
import { RESEARCH_CONSENT_VERSION } from '../research-consent-contract'
import { researchFixture } from '@/lib/graph/__tests__/fixtures/public-research'

const databaseUrl = process.env.GROWTH_TEST_DATABASE_URL
describe.skipIf(!databaseUrl)('research consent on isolated local PostgreSQL fixtures', () => {
  it('records prospective grants and withholds a previously eligible release after withdrawal or deletion', async () => {
    const url = new URL(databaseUrl!)
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Research fixtures require loopback PostgreSQL')
    const admin = new PrismaClient({ datasourceUrl: databaseUrl })
    const schema = `research_consent_test_${randomUUID().replaceAll('-', '')}`
    url.searchParams.set('schema', schema)
    const db = new PrismaClient({ datasourceUrl: url.toString() })
    fixture.db = db; fixture.schema = schema
    try {
      await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`)
      await admin.$executeRawUnsafe(`CREATE TABLE "${schema}".projects (id text PRIMARY KEY, "userId" text, url text, "deletedAt" timestamp(3))`)
      await admin.$executeRawUnsafe(`CREATE TABLE "${schema}".site_lifecycle_events (id text PRIMARY KEY, name text, version int, "idempotencyKey" text UNIQUE, "userId" text, "projectId" text, properties jsonb, "createdAt" timestamp(3))`)
      await admin.$executeRawUnsafe(`CREATE TABLE "${schema}".audits (id text PRIMARY KEY, "projectId" text, "userId" text, url text, status text, "createdAt" timestamp(3), "completedAt" timestamp(3))`)
      await admin.$executeRawUnsafe(`CREATE TYPE "${schema}"."FlagSource" AS ENUM ('DETERMINISTIC', 'AI', 'JOURNEY')`)
      await admin.$executeRawUnsafe(`CREATE TABLE "${schema}".flags (id text PRIMARY KEY, "auditId" text, "checkId" text, source "${schema}"."FlagSource", confidence double precision, "createdAt" timestamp(3))`)
      await admin.$executeRawUnsafe(`CREATE TABLE "${schema}".graph_artifact (id text PRIMARY KEY DEFAULT 'manifest', path text UNIQUE, kind text, payload jsonb, "writtenAt" timestamp(3) DEFAULT NOW())`)

      const windowStart = new Date(Date.now() - 1_000)
      const sources: Array<{ projectId: string; grantId: string; auditId: string }> = []
      for (let i = 0; i < 20; i++) {
        const owner = { projectId: `project${i}`, userId: `owner${i}` }
        const siteUrl = `https://synthetic${i}.example/`
        await admin.$executeRawUnsafe(`INSERT INTO "${schema}".projects VALUES ($1, $2, $3, NULL)`, owner.projectId, owner.userId, siteUrl)
        expect((await loadResearchConsent(owner)).enabled).toBe(false)
        const granted = await saveResearchConsent(owner, { enabled: true, policyVersion: RESEARCH_CONSENT_VERSION })
        const grant = await db.siteLifecycleEvent.findFirstOrThrow({ where: { projectId: owner.projectId }, orderBy: { createdAt: 'desc' } })
        expect(granted.enabled).toBe(true)
        expect(await saveResearchConsent(owner, { enabled: true, policyVersion: RESEARCH_CONSENT_VERSION })).toEqual(granted)
        const createdAt = new Date(grant.createdAt.getTime() + 1)
        const completedAt = new Date(createdAt.getTime() + 1)
        await admin.$executeRawUnsafe(`INSERT INTO "${schema}".audits VALUES ($1, $2, $3, $4, 'COMPLETED', $5, $6)`,
          `audit${i}`, owner.projectId, owner.userId, siteUrl, createdAt, completedAt)
        sources.push({ projectId: owner.projectId, grantId: grant.id, auditId: `audit${i}` })
        await admin.$executeRawUnsafe(`INSERT INTO "${schema}".flags VALUES ($1, $2, 'security-headers-missing', 'DETERMINISTIC', 0.95, $3)`, `flag${i}`, `audit${i}`, completedAt)
      }
      const dataset = researchFixture()
      dataset.sampleSiteCount = 20; dataset.issues[0].siteCount = 20
      dataset.issues[0].occurrenceCount = 20; dataset.issues[0].topFrameworks = []
      dataset.windowStart = windowStart.toISOString(); dataset.windowEnd = new Date(Date.now() + 10).toISOString()
      dataset.reviewedAt = dataset.windowEnd; dataset.expiresAt = new Date(Date.now() + 86_400_000).toISOString()
      const manifest = { version: 1, evidenceRef: dataset.evidenceRef, sources }
      await admin.$executeRawUnsafe(`INSERT INTO "${schema}".graph_artifact (path, kind, payload) VALUES ($1, $2, $3::jsonb)`, RESEARCH_PERMISSIONS_PATH, RESEARCH_PERMISSIONS_KIND, JSON.stringify(manifest))
      expect(await hasCurrentResearchPermissions(dataset)).toBe(true)

      const first = { projectId: 'project0', userId: 'owner0' }
      await expect(saveResearchConsent({ ...first, userId: 'foreign' }, { enabled: false })).rejects.toMatchObject({ status: 404 })
      expect(await hasCurrentResearchPermissions(dataset)).toBe(true)
      await saveResearchConsent(first, { enabled: false })
      expect((await loadResearchConsent(first)).enabled).toBe(false)
      expect(await hasCurrentResearchPermissions(dataset)).toBe(false)
      await saveResearchConsent(first, { enabled: true, policyVersion: RESEARCH_CONSENT_VERSION })
      expect(await hasCurrentResearchPermissions(dataset)).toBe(false)
      await admin.$executeRawUnsafe(`UPDATE "${schema}".projects SET "deletedAt" = NOW() WHERE id = 'project1'`)
      await expect(loadResearchConsent({ projectId: 'project1', userId: 'owner1' })).rejects.toMatchObject({ status: 404 })
    } finally {
      await db.$disconnect()
      await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
      await admin.$disconnect()
    }
  }, 30_000)
})
