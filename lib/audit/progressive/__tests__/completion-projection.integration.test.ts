import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { parseMetadataFromHtml } from '../../metadata'
import { serializeArtifact } from '../contracts'
import { siteAnalysisAuditWhere } from '@/lib/sites/application/analysis-scope'
import { recordedPages } from '../lifecycle'

const localDatabase = process.env.PROGRESSIVE_PROJECTION_DB_REQUIRED === 'true' ? describe : describe.skip
localDatabase('bounded PostgreSQL completion projection', () => {
  it('reads page facts and findings without transferring collector bodies or traces', async () => {
    const configured = process.env.DATABASE_URL
    if (!configured || !['localhost', '127.0.0.1'].includes(new URL(configured).hostname))
      throw new Error('Completion projection integration requires local PostgreSQL')
    const url = 'https://example.com/'
    const metadata = parseMetadataFromHtml('<title>Projected page</title><h1>Page</h1>', url)
    await prisma.$transaction(async tx => {
      // A connection-local fixture shadows the public table. This test neither
      // applies pending migrations nor mutates existing customer records.
      await tx.$executeRaw`CREATE TEMP TABLE audit_verifier_executions (
        "id" text, "auditId" text, "pageUrl" text, "targetKey" text, "workKind" text,
        "workState" text, "status" text, "workInput" jsonb, "workResult" jsonb, "createdAt" timestamp
      ) ON COMMIT DROP`
      const input = JSON.stringify({ position: 0, pageUrl: url, primary: true, role: 'primary' })
      const browser = JSON.stringify(serializeArtifact('browser', { pageId: 'page', metadata,
        snapshot: { desktopUrl: null, mobileUrl: null, desktopHtml: 'x'.repeat(1_100_000), networkFailures: [{ unprojected: true }] } }))
      const http = JSON.stringify(serializeArtifact('http', { metadata, document: { body: 'x'.repeat(1_100_000) } }))
      const flag = { checkId: 'fixture-check', rubric: 'EXPERIENCE', severity: 'IMPORTANT', problem: 'Recorded problem',
        evidence: 'Observed evidence', fix: 'Resolve the cause', confidence: 1, source: 'DETERMINISTIC', pageUrl: url }
      const check = JSON.stringify(serializeArtifact('check', { flags: [flag] }))
      for (const [kind, result] of [['browser', browser], ['http', http], ['check', check]]) {
        await tx.$executeRaw`INSERT INTO audit_verifier_executions VALUES (
          ${kind}, 'audit', ${url}, ${'task:p0:' + kind}, ${kind}, 'COMPLETED', 'COMPLETED', ${input}::jsonb, ${result}::jsonb, now())`
      }
      const pages = await recordedPages('audit', undefined, tx)
      expect(pages).toHaveLength(1)
      expect(pages[0]).toMatchObject({ pageId: 'page', url, metadata: { title: 'Projected page' },
        desktopScreenshot: false, flags: [flag], failedModules: [] })
      expect(await recordedPages('audit', 'https://example.com/other', tx)).toEqual([])
    })
  })
  it('excludes setup observations while retaining legacy and current Site history', async () => {
    const configured = process.env.DATABASE_URL
    if (!configured || !['localhost', '127.0.0.1'].includes(new URL(configured).hostname))
      throw new Error('Completion projection integration requires local PostgreSQL')
    const schema = 'fixflags_projection_' + randomUUID().replaceAll('-', '')
    const url = new URL(configured)
    url.searchParams.set('schema', schema)
    const isolated = new PrismaClient({ datasources: { db: { url: url.toString() } } })
    try {
      // Identifiers contain only this generated prefix and UUID, never input.
      await prisma.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`)
      await prisma.$executeRawUnsafe(`CREATE TABLE "${schema}".audits ("id" text, "executionSpec" jsonb)`)
      await prisma.$executeRawUnsafe(`INSERT INTO "${schema}".audits VALUES ('legacy-sql-null', NULL), ('legacy-json-null', 'null'::jsonb),
        ('legacy-object', '{"version":1}'::jsonb), ('site', '{"scope":"SITE"}'::jsonb), ('setup', '{"scope":"FIXTURE_SETUP"}'::jsonb)`)
      const rows = await isolated.audit.findMany({ where: siteAnalysisAuditWhere, select: { id: true }, orderBy: { id: 'asc' } })
      expect(rows.map(row => row.id)).toEqual(['legacy-json-null', 'legacy-object', 'legacy-sql-null', 'site'])
    } finally {
      await isolated.$disconnect()
      await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
    }
  })

})
