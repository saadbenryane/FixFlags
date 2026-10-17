import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { parseMetadataFromHtml } from '../../metadata'
import { serializeArtifact } from '../contracts'
import { siteAnalysisAuditWhere } from '@/lib/sites/application/analysis-scope'
import { recordedPages, recordedPageEvidence } from '../lifecycle'
import { commitFindings } from '../results'
import type { TaskContext } from '../registry'
import { evaluatorHandlers } from '../evaluators'
import { finalizeDeterministicOnly } from '../../finalize'

const localDatabase = process.env.PROGRESSIVE_PROJECTION_DB_REQUIRED === 'true' ? describe : describe.skip
localDatabase('bounded PostgreSQL completion projection', () => {
  beforeAll(() => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
  })
  it('retains recorded coverage gaps when a deterministic finalizer has every required collector', async () => {
    const audit = await prisma.audit.create({ data: { url: 'https://example.com/', status: 'FINALIZING', failedModules: ['performance'] } })
    try {
      await finalizeDeterministicOnly({ auditId: audit.id, durationMs: 100, pagespeedCalls: 2, pagesReviewed: 1,
        evidence: { desktopScreenshot: true, mobileScreenshot: true, metadata: true, desktopPageSpeed: true, mobilePageSpeed: true } })
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({ status: 'COMPLETED',
        reportCompleteness: 'PARTIAL', failedModules: ['performance'] })
    } finally { await prisma.audit.delete({ where: { id: audit.id } }) }
  })
  it('replaces late duplicate warnings while retaining their source observations and remaining page incident', async () => {
    const root = 'https://example.com/', pricing = 'https://example.com/pricing'
    const audit = await prisma.audit.create({ data: { url: root, status: 'CHECKING' } })
    const context = { audit } as TaskContext
    const finding = (checkId: string, pageUrl: string) => ({ checkId, pageUrl, rubric: 'EXPERIENCE', severity: 'IMPORTANT',
      problem: 'Missing heading', evidence: 'Captured heading is absent', fix: 'Add the page heading', confidence: 1, source: 'DETERMINISTIC' })
    const initial = serializeArtifact('check', { flags: [finding('hierarchy-no-headline', root), finding('hierarchy-no-headline', pricing)] })
    try {
      await prisma.$transaction(tx => commitFindings(context, initial, tx))
      const broad = await prisma.flag.findFirstOrThrow({ where: { auditId: audit.id, checkId: 'hierarchy-no-headline' } })
      expect(broad.affectedPaths).toEqual([root, pricing])
      await prisma.auditVerifierExecution.create({ data: { auditId: audit.id, targetKey: 'task:initial', source: 'DETERMINISTIC',
        status: 'COMPLETED', workState: 'COMPLETED', workKind: 'check', workResult: initial } })
      const healthyTask = await prisma.auditVerifierExecution.create({ data: { auditId: audit.id, targetKey: 'task:healthy', source: 'DETERMINISTIC',
        status: 'RUNNING', workState: 'RUNNING', workKind: 'check' } })
      const healthyReceipt = { kind: 'site-module-check', version: 1, module: 'slop', pageUrl: root, passed: true, applicable: true, complete: true,
        assertions: [{ key: 'placeholder-patterns', name: 'Captured copy', expected: 'No placeholder patterns', observed: 'No placeholder patterns observed',
          passed: true, complete: true, disposition: 'observed' }],
        execution: { auditId: audit.id, taskId: healthyTask.id, checkVersion: 1, source: 'rendered-dom', collectedAt: new Date().toISOString() } }
      await prisma.$transaction(async tx => {
        const read = vi.fn(tx.$queryRaw.bind(tx))
        const observed = new Proxy(tx, { get(target, key, receiver) { return key === '$queryRaw' ? read : Reflect.get(target, key, receiver) } })
        await evaluatorHandlers.find(handler => handler.kind === 'check')!.commit!({ ...context, task: healthyTask,
          input: { pageUrl: root, primary: true, position: 0, role: 'primary', module: 'slop' } },
        serializeArtifact('check', { flags: [], receipt: healthyReceipt }), observed)
        expect(read).not.toHaveBeenCalled()
      })
      expect(await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: audit.id, targetKey: 'module:slop' } }))
        .toMatchObject({ detail: healthyReceipt })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: broad.id } })).toEqual(broad)
      const rootSpecific = serializeArtifact('check', { flags: [finding('h1-missing', root)] })
      await prisma.$transaction(tx => commitFindings(context, rootSpecific, tx))
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: broad.id } })).toMatchObject({ pageUrl: pricing, affectedPaths: [pricing] })
      const specific = await prisma.flag.findFirstOrThrow({ where: { auditId: audit.id, checkId: 'h1-missing' } })
      await prisma.auditVerifierExecution.create({ data: { auditId: audit.id, targetKey: 'task:root', source: 'DETERMINISTIC',
        status: 'COMPLETED', workState: 'COMPLETED', workKind: 'check', workResult: rootSpecific } })
      await prisma.$transaction(tx => commitFindings(context, serializeArtifact('check', { flags: [finding('h1-missing', pricing)] }), tx))
      expect(await prisma.flag.findMany({ where: { auditId: audit.id } })).toEqual([
        expect.objectContaining({ id: specific.id, checkId: 'h1-missing', affectedPaths: [pricing, root] }),
      ])
      expect(await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: audit.id, targetKey: 'task:initial' } }))
        .toMatchObject({ workResult: initial })
    } finally { await prisma.audit.delete({ where: { id: audit.id } }) }
  })

  it('retains customer feedback and finalized historical warnings when a more specific observation arrives', async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    for (const protection of ['feedback', 'finalized'] as const) {
      const url = 'https://example.com/'
      const audit = await prisma.audit.create({ data: { url, status: 'CHECKING' } })
      const context = { audit } as TaskContext
      const finding = { checkId: 'hierarchy-no-headline', pageUrl: url, rubric: 'EXPERIENCE', severity: 'IMPORTANT',
        problem: 'Missing heading', evidence: 'Captured heading is absent', fix: 'Add the page heading', confidence: 1, source: 'DETERMINISTIC' }
      const initial = serializeArtifact('check', { flags: [finding] })
      try {
        await prisma.$transaction(tx => commitFindings(context, initial, tx))
        const broad = await prisma.flag.findFirstOrThrow({ where: { auditId: audit.id, checkId: finding.checkId } })
        if (protection === 'feedback') await prisma.flagFeedback.create({ data: { flagId: broad.id, vote: 1, visitorToken: randomUUID() } })
        else await prisma.audit.update({ where: { id: audit.id }, data: { status: 'COMPLETED', finalizedAt: new Date() } })
        await prisma.auditVerifierExecution.create({ data: { auditId: audit.id, targetKey: 'task:initial', source: 'DETERMINISTIC',
          status: 'COMPLETED', workState: 'COMPLETED', workKind: 'check', workResult: initial } })
        await prisma.$transaction(tx => commitFindings(context, serializeArtifact('check', { flags: [{ ...finding, checkId: 'h1-missing' }] }), tx))
        expect(await prisma.flag.findUnique({ where: { id: broad.id } })).not.toBeNull()
        if (protection === 'feedback') expect(await prisma.flagFeedback.count({ where: { flagId: broad.id } })).toBe(1)
      } finally { await prisma.audit.delete({ where: { id: audit.id } }) }
    }
  })

  it('preserves distinct page incidents through committed findings and replay', async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    const root = 'https://example.com/', pricing = 'https://example.com/pricing'
    const audit = await prisma.audit.create({ data: { url: root } })
    const finding = (checkId: string, pageUrl: string) => ({ checkId, pageUrl, rubric: 'EXPERIENCE', severity: 'IMPORTANT',
      problem: 'Missing heading', evidence: 'Captured heading is absent', fix: 'Add the page heading', confidence: 1, source: 'DETERMINISTIC' })
    const rootArtifact = serializeArtifact('check', { flags: [finding('h1-missing', root), finding('hierarchy-no-headline', root)] })
    const pricingArtifact = serializeArtifact('check', { flags: [finding('hierarchy-no-headline', pricing)] })
    try {
      await prisma.auditVerifierExecution.create({ data: { auditId: audit.id, targetKey: 'task:root', source: 'DETERMINISTIC',
        pageUrl: root, status: 'COMPLETED', workState: 'COMPLETED', workKind: 'check', workResult: rootArtifact } })
      const context = { audit: { id: audit.id } } as TaskContext
      await prisma.$transaction(tx => commitFindings(context, pricingArtifact, tx))
      const select = { id: true, checkId: true, pageUrl: true, affectedPaths: true } as const
      const before = await prisma.flag.findMany({ where: { auditId: audit.id }, select, orderBy: { checkId: 'asc' } })
      expect(before).toHaveLength(2)
      expect(before).toEqual([
        expect.objectContaining({ checkId: 'h1-missing', pageUrl: root, affectedPaths: [root] }),
        expect.objectContaining({ checkId: 'hierarchy-no-headline', pageUrl: pricing, affectedPaths: [pricing] }),
      ])
      await prisma.auditVerifierExecution.create({ data: { auditId: audit.id, targetKey: 'task:pricing', source: 'DETERMINISTIC',
        pageUrl: pricing, status: 'COMPLETED', workState: 'COMPLETED', workKind: 'check', workResult: pricingArtifact } })
      await prisma.$transaction(tx => commitFindings(context, rootArtifact, tx))
      expect(await prisma.flag.findMany({ where: { auditId: audit.id }, select, orderBy: { checkId: 'asc' } })).toEqual(before)
    } finally { await prisma.audit.delete({ where: { id: audit.id } }) }
  })

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
        "workState" text, "status" text, "workInput" jsonb, "workResult" jsonb, "createdAt" timestamp,
        "detail" jsonb, "evidenceReference" jsonb
      ) ON COMMIT DROP`
      const input = JSON.stringify({ position: 0, pageUrl: url, primary: true, role: 'primary' })
      const browser = JSON.stringify(serializeArtifact('browser', { pageId: 'page', metadata,
        preview: { version: 1, scope: { pageUrl: url, finalUrl: url, profile: 'fixture', access: 'public' },
          title: 'Native preview', ogTitle: null, ogDescription: null, titleComplete: true, descriptionComplete: true },
        snapshot: { desktopUrl: null, mobileUrl: null, desktopHtml: 'x'.repeat(1_100_000), networkFailures: [{ unprojected: true }],
          renderedSearchSnapshot: { documentBaseUrl: url + 'docs/', sections: {
            links: { html: '<a href="pricing">Pricing</a>', complete: true, reason: null, observed: 1, limit: 2000 },
            text: { unprojected: 'x'.repeat(1_100_000) },
          } } } }))
      const http = JSON.stringify(serializeArtifact('http', { metadata, document: { body: 'x'.repeat(1_100_000) } }))
      const flag = { checkId: 'fixture-check', rubric: 'EXPERIENCE', severity: 'IMPORTANT', problem: 'Recorded problem',
        evidence: 'Observed evidence', fix: 'Resolve the cause', confidence: 1, source: 'DETERMINISTIC', pageUrl: url }
      const check = JSON.stringify(serializeArtifact('check', { flags: [flag] }))
      const journeyFlag = { ...flag, checkId: 'overlay-blocks-nav', problem: 'Recorded journey cover' }
      const journey = JSON.stringify(serializeArtifact('journeys', { flags: [journeyFlag],
        overlayReceipts: [{ unprojected: 'x'.repeat(1_100_000) }] }))
      for (const [kind, result] of [['browser', browser], ['http', http], ['check', check], ['journeys', journey]]) {
        await tx.$executeRaw`INSERT INTO audit_verifier_executions
          ("id", "auditId", "pageUrl", "targetKey", "workKind", "workState", "status", "workInput", "workResult", "createdAt") VALUES (
          ${kind}, 'audit', ${url}, ${'task:p0:' + kind}, ${kind}, 'COMPLETED', 'COMPLETED', ${input}::jsonb, ${result}::jsonb, now())`
      }
      const pages = await recordedPages('audit', undefined, tx)
      expect(pages).toHaveLength(1)
      expect(pages[0]).toMatchObject({ pageId: 'page', url, metadata: { title: 'Projected page' },
        desktopScreenshot: false, flags: [flag, journeyFlag], failedModules: [] })
      const gap = JSON.stringify({ complete: false }), reference = JSON.stringify({ taskId: 'check' })
      await tx.$executeRaw`INSERT INTO audit_verifier_executions ("id", "auditId", "pageUrl", "targetKey", "status", "detail", "evidenceReference")
        VALUES ('gap', 'audit', 'https://example.com/redirected', 'module:performance', 'COMPLETED', ${gap}::jsonb, ${reference}::jsonb),
          ('inapplicable', 'audit', ${url}, 'module:mobile', 'NOT_APPLICABLE', ${gap}::jsonb, ${reference}::jsonb)`
      const partial = await recordedPages('audit', url, tx)
      expect(partial).toHaveLength(1)
      expect(partial[0]).toMatchObject({ flags: [flag, journeyFlag], failedModules: ['performance'], metadata: { title: 'Projected page' } })
      expect(await recordedPages('audit', 'https://example.com/other', tx)).toEqual([])
      await tx.$executeRaw`UPDATE audit_verifier_executions SET "workResult" = jsonb_set("workResult", '{data,metadata}', 'null'::jsonb)
        WHERE "workKind" IN ('browser', 'http')`
      const independent = await recordedPageEvidence('audit', url, tx)
      expect(independent).toHaveLength(1)
      expect(independent[0]).toMatchObject({ url, primary: true, metadata: null,
        navigation: { linkBaseUrl: url + 'docs/', links: [{ href: 'pricing', text: 'Pricing' }], complete: true },
        preview: { title: 'Native preview', titleComplete: true }, flags: [flag, journeyFlag], failedModules: ['performance'] })
      expect(JSON.stringify(independent)).not.toContain('unprojected')
      expect(await recordedPages('audit', url, tx)).toEqual([])
      await tx.$executeRaw`UPDATE audit_verifier_executions SET "workResult" = jsonb_set("workResult", '{data,metadataFailure}',
        '{"code":"PARSER_CRASH","attempts":2}'::jsonb) WHERE "workKind" IN ('browser', 'http')`
      expect((await recordedPageEvidence('audit', url, tx))[0]).toMatchObject({ metadata: null,
        flags: [flag, journeyFlag], failedModules: ['metadata', 'performance'] })
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
