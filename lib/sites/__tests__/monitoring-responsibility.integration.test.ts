import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { Prisma, type Audit } from '@prisma/client'
import { prisma } from '@/lib/db'
import { analysisEnvironmentWhere, siteWideAnalysisAuditWhere } from '../application/analysis-scope'
import { loadRunSourceEnvironment } from '../application/run-requests'
import { buildExecutionSpec } from '../application/execution-spec'
import { monitoringResponsibility, monitoringBehaviorResponsibility } from '../application/monitoring-responsibility'

const localDatabase = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
localDatabase('combined recorded monitoring responsibility', () => {
  beforeAll(() => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
  })
  it('retains independent admitted branches and missing rows without borrowing another tenant, environment or targeted scope', async () => {
    const root = 'https://example.com/', owner = 'scope-ledger-' + randomUUID(), otherOwner = 'other-' + owner
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test' } })
    try {
      await prisma.user.create({ data: { id: otherOwner, email: otherOwner + '@example.test' } })
      const project = await prisma.project.create({ data: { userId: owner, name: 'Owned Site', url: root, canonicalHost: 'example.com' } })
      const other = await prisma.project.create({ data: { userId: otherOwner, name: 'Other Site', url: 'https://other.example/', canonicalHost: 'other.example' } })
      const spec = (url: string, pages = [url], environment = 'production') => ({ version: 1, engine: 'progressive-v1', scope: 'SITE',
        targetUrl: url, environment, monitoringPages: pages, checks: {}, outcomes: [], verificationTarget: null })
      const source = async (url: string, executionSpec: Prisma.InputJsonValue | typeof Prisma.DbNull = spec(url), extras: object = {}) => prisma.audit.create({
        data: { url, projectId: project.id, userId: owner, status: 'COMPLETED', executionSpec, ...extras },
      })
      const prior = await source(root + 'first', spec(root + 'first', [root + 'first', root + 'missing/', root + 'plans?q=one/']))
      await prisma.auditPage.create({ data: { auditId: prior.id, url: root + 'recorded/', normalizedUrl: root + 'recorded/',
        status: 'FAILED', role: 'review', position: 0 } })
      const planned = await prisma.auditExecutionTask.create({ data: { auditId: prior.id, targetKey: 'task:planned-browser', workKind: 'browser',
        pageUrl: root + 'planned/?q=two', source: 'EXECUTION', status: 'FAILED', workState: 'EXHAUSTED' } })
      await source(root + 'current')
      const legacy = await source(root + 'legacy', Prisma.DbNull)
      await prisma.runRequest.create({ data: { projectId: project.id, auditId: legacy.id, source: 'WATCH', idempotencyKey: 'legacy-broad', executionSpec: spec(legacy.url) } })
      await source(root + 'other-project', spec(root + 'other-project'), { projectId: other.id, userId: otherOwner })
      await source(root + 'staging', spec(root + 'staging', [root + 'staging', root + 'staging-missing'], 'staging'))
      await source(root + 'diagnostic', { ...spec(root + 'diagnostic'), scope: 'DIAGNOSTIC' })
      await source(root + 'category', { ...spec(root + 'category'), scope: 'CATEGORY' })
      const failed = await source(root + 'failed', spec(root + 'failed'), { status: 'FAILED' })
      await source(root + 'queued', spec(root + 'queued', [root + 'queued', root + 'not-yet-planned/']), { status: 'QUEUED' })
      await source(root + 'old-binding', { ...spec(root + 'old-binding', [root + 'old-binding', root + 'retained-intent/']),
        outcomes: [{ id: 'historical', kind: 'GENERIC', expectation: null, bindingPolicy: 'ALL_REQUIRED',
          bindings: [{ key: 'old', version: 1, mechanism: 'OBSOLETE', required: true, config: {}, scope: null }] }] })
      await source(root + 'future', { ...spec(root + 'future'), version: 2 })
      await source(root + 'string-version', { ...spec(root + 'string-version'), version: '1' })
      await source(root + 'bad-target', spec(root + 'unrelated', [root + 'unrelated', root + 'invented']))
      await source(root + 'duplicate', spec(root + 'duplicate', [root + 'duplicate', root + 'duplicate', root + 'invalid-cohort']))
      // Repeated historical runs collapse in PostgreSQL instead of transferring
      // whole execution specifications and collector payloads to admission.
      await prisma.audit.createMany({ data: Array.from({ length: 200 }, () => ({ url: root, projectId: project.id, userId: owner,
        status: 'COMPLETED' as const, executionSpec: spec(root) })) })
      const read = vi.spyOn(prisma, '$queryRaw')
      const pages = await monitoringResponsibility({ projectId: project.id, environment: 'production', targetUrl: root, recorded: [root, root + 'current'] })
      expect(read).toHaveBeenCalledTimes(1)
      read.mockRestore()
      expect(pages).toEqual(expect.arrayContaining([root, root + 'current', root + 'first', root + 'missing/', root + 'plans?q=one/',
        root + 'recorded/', root + 'planned/?q=two', root + 'legacy', root + 'failed', root + 'queued', root + 'not-yet-planned/', root + 'retained-intent/']))
      for (const path of ['other-project', 'staging', 'staging-missing', 'diagnostic', 'category', 'future', 'string-version',
        'unrelated', 'invented', 'invalid-cohort']) expect(pages).not.toContain(root + path)
      const entries = (await monitoringBehaviorResponsibility({ projectId: project.id, environment: 'production', pages })).map(scope => scope.pageUrl)
      expect(entries).toEqual(expect.arrayContaining([root, root + 'first', root + 'current', root + 'legacy', root + 'failed', root + 'queued', root + 'old-binding']))
      for (const path of ['recorded/', 'planned/?q=two', 'missing/', 'plans?q=one/', 'not-yet-planned/', 'retained-intent/']) expect(entries).not.toContain(root + path)
      const staging = await monitoringResponsibility({ projectId: project.id, environment: 'staging', targetUrl: root, recorded: [] })
      expect(staging).toEqual([root, root + 'staging', root + 'staging-missing'])
      expect(await prisma.auditPage.findMany({ where: { auditId: prior.id } })).toHaveLength(1)
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: failed.id } })).toMatchObject({ status: 'FAILED' })
      expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: planned.id } }))
        .toMatchObject({ workState: 'EXHAUSTED', status: 'FAILED' })
    } finally { await prisma.user.deleteMany({ where: { id: { in: [owner, otherOwner] } } }) }
  })
  it('preserves frozen entry responsibility without source observations and rejects malformed or unrelated intent', async () => {
    const root = 'https://example.com/', owner = 'entry-snapshot-' + randomUUID()
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test' } })
    try {
      const project = await prisma.project.create({ data: { userId: owner, name: 'Retained entries', url: root, canonicalHost: 'example.com' } })
      const retained = root + 'plans/?plan=team#choose', discovered = root + 'about'
      const spec = { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: root, environment: 'production',
        monitoringPages: [root, retained, discovered], monitoringEntryPages: [root, retained], checks: {}, outcomes: [], verificationTarget: null }
      const save = (executionSpec: Prisma.InputJsonValue) => prisma.audit.create({ data: { projectId: project.id, userId: owner, url: root,
        status: 'FAILED', executionSpec } })
      // This saved admission is the only remaining evidence of the earlier entry.
      await save({ ...spec, outcomes: [{ bindings: [{ mechanism: 'OBSOLETE' }] }] })
      await save({ ...spec, monitoringEntryPages: [discovered, discovered] })
      await save({ ...spec, targetUrl: root + 'mismatch', monitoringPages: [root + 'mismatch', discovered], monitoringEntryPages: [discovered] })
      await save({ ...spec, monitoringPages: [root], monitoringEntryPages: [discovered] })
      await save({ ...spec, scope: 'DIAGNOSTIC', monitoringEntryPages: [discovered] })
      await save({ ...spec, environment: 'staging', monitoringEntryPages: [discovered] })
      const pages = await monitoringResponsibility({ projectId: project.id, targetUrl: root, environment: 'production', recorded: [root, retained, discovered] })
      expect((await monitoringBehaviorResponsibility({ projectId: project.id, environment: 'production', pages })).map(scope => scope.pageUrl)).toEqual([root, retained])
      expect((await monitoringBehaviorResponsibility({ projectId: project.id, environment: 'production', pages: [root, discovered] })).map(scope => scope.pageUrl)).toEqual([root])
      expect(await prisma.auditPage.count({ where: { audit: { projectId: project.id } } })).toBe(0)
    } finally { await prisma.user.delete({ where: { id: owner } }) }
  })
  it('retains public task responsibility from interrupted categories without copying other kinds or verification scope', async () => {
    const root = 'https://example.com/', owner = 'behavior-history-' + randomUUID()
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test' } })
    try {
      const project = await prisma.project.create({ data: { userId: owner, name: 'Behavior history', url: root, canonicalHost: 'example.com' } })
      const flow = root + 'flow/?plan=team#choose', slow = root + 'slow/', journey = root + 'journey/', pricing = root + 'pricing/', restored = root + 'restored/'
      const pages = [root, flow, slow, journey, pricing, restored]
      const create = (scope: string, area = 'conversion', environment = 'production') => prisma.audit.create({ data: {
        projectId: project.id, userId: owner, url: root, status: 'FAILED', executionSpec: { version: 1, engine: 'progressive-v1', scope,
          targetUrl: root, environment, ...(scope === 'CATEGORY' ? { category: { area, sourceAuditId: 'original-broad', pages } } : {}),
          checks: {}, outcomes: [], verificationTarget: null },
      } })
      const category = await create('CATEGORY'), performance = await create('CATEGORY', 'performance'), diagnostic = await create('DIAGNOSTIC'), staging = await create('CATEGORY', 'conversion', 'staging')
      const task = (auditId: string, pageUrl: string, kind: string, module?: string) => ({ auditId, pageUrl, workKind: kind,
        targetKey: 'task:' + randomUUID(), source: 'EXECUTION' as const, status: 'FAILED' as const, workState: 'EXHAUSTED' as const,
        workInput: { pageUrl, ...(module ? { module } : {}) } })
      await prisma.auditVerificationReceipt.createMany({ data: [task(category.id, flow, 'flow'), task(category.id, flow, 'flow'),
        task(category.id, journey, 'journeys'), task(category.id, pricing, 'flow', 'pricing-navigation'), task(performance.id, slow, 'slow-replay'),
        task(category.id, slow, 'flow', 'form-validation'), task(category.id, slow, 'flow', 'mobile-navigation'), task(category.id, slow, 'bindings'),
        task(diagnostic.id, flow, 'journeys'), task(staging.id, flow, 'slow-replay')] })
      const frozen = await prisma.audit.create({ data: { projectId: project.id, userId: owner, url: root, status: 'QUEUED',
        executionSpec: { version: 1, scope: 'SITE', targetUrl: root, environment: 'production', monitoringPages: pages,
          monitoringBehaviors: [{ pageUrl: restored, behaviors: ['pricing-navigation'] }], checks: {}, outcomes: [{ bindings: [{ mechanism: 'OBSOLETE' }] }], verificationTarget: null } } })
      expect(await monitoringBehaviorResponsibility({ projectId: project.id, environment: 'production', pages })).toEqual([
        { pageUrl: root, behaviors: ['flow', 'pricing-navigation', 'slow-replay', 'journeys'] },
        { pageUrl: flow, behaviors: ['flow'] }, { pageUrl: slow, behaviors: ['slow-replay'] }, { pageUrl: journey, behaviors: ['journeys'] },
        { pageUrl: pricing, behaviors: ['pricing-navigation'] }, { pageUrl: restored, behaviors: ['pricing-navigation'] },
      ])
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: frozen.id } })).toMatchObject({ status: 'QUEUED' })
      expect(await prisma.auditVerifierExecution.count({ where: { auditId: category.id } })).toBe(7)
    } finally { await prisma.user.delete({ where: { id: owner } }) }
  })
  it('freezes newly admitted category behavior before any worker task rows exist', async () => {
    const root = 'https://example.com/', page = root + 'new-action/', owner = 'queued-category-' + randomUUID()
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test' } })
    try {
      const project = await prisma.project.create({ data: { userId: owner, name: 'Queued care', url: root, canonicalHost: 'example.com' } })
      await prisma.audit.create({ data: { projectId: project.id, userId: owner, url: root, status: 'COMPLETED', executionSpec: {
        version: 1, scope: 'SITE', targetUrl: root, environment: 'production', monitoringPages: [root, page], checks: {}, outcomes: [], verificationTarget: null,
      } } })
      const spec = await buildExecutionSpec({ projectId: project.id, targetUrl: root, scope: 'CATEGORY', categoryArea: 'conversion', environment: 'production', outcomes: [] })
      expect(spec.monitoringEntryPages).toBeUndefined()
      expect(spec.monitoringBehaviors?.find(scope => scope.pageUrl === page)?.behaviors).toEqual(['flow', 'pricing-navigation'])
      const category = await prisma.audit.create({ data: { projectId: project.id, userId: owner, url: root, status: 'QUEUED', executionSpec: spec as Prisma.InputJsonValue } })
      expect(await prisma.auditVerifierExecution.count({ where: { auditId: category.id } })).toBe(0)
      expect((await monitoringBehaviorResponsibility({ projectId: project.id, environment: 'production', pages: [root, page] })).find(scope => scope.pageUrl === page))
        .toEqual({ pageUrl: page, behaviors: ['flow', 'pricing-navigation'] })
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: category.id } })).toMatchObject({ status: 'QUEUED' })
    } finally { await prisma.user.delete({ where: { id: owner } }) }
  })
  it.each([true, false])('uses legacy RunRequest environment without borrowing staging scope into production, frozen environment: %s', async withFrozenEnvironment => {
    const root = 'https://example.com/', owner = 'environment-intent-' + randomUUID()
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test' } })
    try {
      const project = await prisma.project.create({ data: { userId: owner, name: 'Environment intent', url: root, canonicalHost: 'example.com' } })
      const production = root + 'production/', preview = root + 'preview/', peer = preview + '?mode=team', retained = preview + 'retained/'
      const spec = (targetUrl: string, environment?: string) => ({ version: 1, scope: 'SITE', targetUrl, ...(environment ? { environment } : {}),
        monitoringPages: [targetUrl], checks: {}, outcomes: [], verificationTarget: null })
      const original = await prisma.audit.create({ data: { projectId: project.id, userId: owner, url: production, status: 'COMPLETED',
        createdAt: new Date('2026-01-01T00:00:00Z'), executionSpec: spec(production, 'production') } })
      const legacy = await prisma.audit.create({ data: { projectId: project.id, userId: owner, url: preview, status: 'COMPLETED',
        createdAt: new Date('2026-01-02T00:00:00Z'), executionSpec: Prisma.DbNull } })
      const request = await prisma.runRequest.create({ data: { projectId: project.id, auditId: legacy.id, source: 'WEB', environment: 'staging',
        idempotencyKey: 'legacy-staging', status: 'COMPLETED', executionSpec: { ...spec(preview, withFrozenEnvironment ? 'staging' : undefined), monitoringPages: [preview, peer, retained],
          monitoringBehaviors: [{ pageUrl: retained, behaviors: ['slow-replay'] }] } } })
      await prisma.auditExecutionTask.createMany({ data: ['browser', 'flow'].map(workKind => ({ auditId: legacy.id, workKind,
        targetKey: 'task:preview:' + workKind, pageUrl: peer, source: 'EXECUTION', status: 'FAILED' as const, workState: 'EXHAUSTED' as const })) })
      const input = { projectId: project.id, targetUrl: root, recorded: [] }
      expect(await monitoringResponsibility({ ...input, environment: 'production' })).toEqual([root, production])
      expect(await monitoringResponsibility({ ...input, environment: 'staging' })).toEqual([root, preview, peer, retained])
      expect(await monitoringBehaviorResponsibility({ projectId: project.id, environment: 'production', pages: [root, production, preview, peer] }))
        .toEqual([root, production].map(pageUrl => ({ pageUrl, behaviors: ['flow', 'pricing-navigation', 'slow-replay', 'journeys'] })))
      expect((await monitoringBehaviorResponsibility({ projectId: project.id, environment: 'staging', pages: [root, preview, peer, retained] })).find(scope => scope.pageUrl === retained))
        .toEqual({ pageUrl: retained, behaviors: ['slow-replay'] })
      const category = (environment: string) => buildExecutionSpec({ projectId: project.id, targetUrl: root, environment,
        scope: 'CATEGORY', categoryArea: 'conversion', outcomes: [] })
      expect((await category('production')).category).toMatchObject({ sourceAuditId: original.id, pages: [production] })
      expect((await category('staging')).category).toMatchObject({ sourceAuditId: legacy.id, pages: [preview, peer, retained] })
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: legacy.id } })).toMatchObject({ executionSpec: null, status: 'COMPLETED' })
      expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: request.id } })).toMatchObject({ environment: 'staging', executionSpec: { ...spec(preview, withFrozenEnvironment ? 'staging' : undefined), monitoringPages: [preview, peer, retained], monitoringBehaviors: [{ pageUrl: retained, behaviors: ['slow-replay'] }] } })
    } finally { await prisma.user.delete({ where: { id: owner } }) }
  })
  it('keeps SQL and ORM source selection aligned through missing, conflicting and malformed environment records', async () => {
    const root = 'https://example.com/', owner = 'environment-boundary-' + randomUUID()
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test' } })
    try {
      const project = await prisma.project.create({ data: { userId: owner, name: 'Environment boundary', url: root, canonicalHost: 'example.com' } })
      const saved = (targetUrl: string, environment?: unknown) => ({ version: 1, scope: 'SITE', targetUrl,
        ...(environment !== undefined ? { environment } : {}), monitoringPages: [targetUrl], checks: {}, outcomes: [], verificationTarget: null })
      type SourceCase = { name: string; expected: string | null; audit?: unknown; requests?: Array<{ environment: string; payload?: unknown; version?: number }> }
      const cases: SourceCase[] = [
        { name: 'explicit-production', audit: 'production', expected: 'production', requests: [{ environment: 'staging', payload: 'staging' }] },
        { name: 'explicit-staging', audit: 'staging', expected: 'staging', requests: [{ environment: 'production', payload: 'production' }] },
        { name: 'legacy-staging', expected: 'staging', requests: [{ environment: 'staging', payload: 'staging' }] },
        { name: 'legacy-column', expected: 'staging', requests: [{ environment: 'staging' }] },
        { name: 'legacy-null', audit: null, expected: 'staging', requests: [{ environment: 'staging', payload: null }] },
        { name: 'unrequested-production', expected: 'production' },
        { name: 'agreeing-requests', expected: 'production', requests: [{ environment: 'production', payload: 'production' }, { environment: 'production' }] },
        { name: 'conflicting-requests', expected: null, requests: [{ environment: 'production', payload: 'production' }, { environment: 'staging', payload: 'staging' }] },
        { name: 'conflicting-production-column', expected: null, requests: [{ environment: 'production', payload: 'staging' }] },
        { name: 'conflicting-staging-column', expected: null, requests: [{ environment: 'staging', payload: 'production' }] },
        { name: 'malformed-audit', audit: 1, expected: null },
        { name: 'malformed-request', expected: null, requests: [{ environment: 'production', payload: 1 }] },
      ]
      const originals: Audit[] = []
      for (const example of cases) {
        const url = root + example.name + '/'
        const source = await prisma.audit.create({ data: { projectId: project.id, userId: owner, url, status: 'COMPLETED',
          executionSpec: saved(url, example.audit) as Prisma.InputJsonValue } })
        originals.push(source)
        for (const [index, request] of (example.requests ?? []).entries()) await prisma.runRequest.create({ data: { projectId: project.id,
          auditId: source.id, source: 'WEB', status: 'COMPLETED', idempotencyKey: example.name + index, environment: request.environment,
          executionSpec: saved(url, request.payload) as Prisma.InputJsonValue } })
        if (example.expected) expect(await loadRunSourceEnvironment(project.id, source.id)).toBe(example.expected)
        else await expect(loadRunSourceEnvironment(project.id, source.id)).rejects.toMatchObject({ status: 409, code: 'SOURCE_ENVIRONMENT_UNAVAILABLE' })
        await expect(loadRunSourceEnvironment('another-project', source.id)).rejects.toMatchObject({ status: 409 })
      }
      for (const environment of ['production', 'staging']) {
        const expected = cases.filter(example => example.expected === environment).map(example => root + example.name + '/')
        const orm = await prisma.audit.findMany({ where: { projectId: project.id, ...siteWideAnalysisAuditWhere,
          AND: [analysisEnvironmentWhere(environment)] }, select: { url: true } })
        expect(orm.map(source => source.url).sort()).toEqual(expected.toSorted())
        expect((await monitoringResponsibility({ projectId: project.id, environment, targetUrl: root, recorded: [] })).sort()).toEqual([root, ...expected].sort())
        expect((await monitoringBehaviorResponsibility({ projectId: project.id, environment, pages: [root, ...originals.map(source => source.url)] })).map(scope => scope.pageUrl).sort())
          .toEqual([root, ...expected].sort())
      }
      expect(await prisma.audit.findMany({ where: { id: { in: originals.map(source => source.id) } }, orderBy: { id: 'asc' } }))
        .toEqual(originals.toSorted((left, right) => left.id.localeCompare(right.id)))
    } finally { await prisma.user.delete({ where: { id: owner } }) }
  })
  it('continues past rejected URLs while keeping the result and transferred batches bounded', async () => {
    const root = 'https://example.com/', owner = 'scope-pagination-' + randomUUID()
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test' } })
    try {
      const project = await prisma.project.create({ data: { userId: owner, name: 'Pagination Site', url: root, canonicalHost: 'example.com' } })
      const data = (url: string) => ({ userId: owner, projectId: project.id, url, status: 'COMPLETED' as const,
        executionSpec: { version: 1, scope: 'SITE', targetUrl: url, environment: 'production', checks: {}, outcomes: [], verificationTarget: null } })
      await prisma.audit.create({ data: data(root + 'retained/') })
      // These rows model incompatible historical or corrupt URLs, not authorized
      // public admissions. They must never crowd out compatible responsibility.
      await prisma.audit.createMany({ data: Array.from({ length: 100 }, (_, index) => data('https://foreign.example/' + index)) })
      const batches: number[] = []
      const read = async <T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]): Promise<T> => {
        const rows = await prisma.$queryRaw<T>(query, ...values)
        if (Array.isArray(rows)) batches.push(rows.length)
        return rows
      }
      expect(await monitoringResponsibility({ projectId: project.id, environment: 'production', targetUrl: root, recorded: [] }, { $queryRaw: read }))
        .toEqual([root, root + 'retained/'])
      expect(batches.length).toBeGreaterThan(1)
      expect(batches.every(length => length <= 48)).toBe(true)
    } finally { await prisma.user.delete({ where: { id: owner } }) }
  })
})
