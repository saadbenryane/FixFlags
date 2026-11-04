import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { parseMetadataFromHtml } from '../../metadata'
import { serializeArtifact } from '../contracts'
import { siteAnalysisAuditWhere } from '@/lib/sites/application/analysis-scope'
import { recordedPages, recordedPageEvidence } from '../lifecycle'
import { checkArtifactSchema, commitFindings, recordedTaskFindings } from '../results'
import { actionHandlers } from '../actions'
import type { TaskContext } from '../registry'
import { evaluatorHandlers } from '../evaluators'
import { finalizeDeterministicOnly } from '../../finalize'
import { reconcileImprovementVerification } from '@/lib/improvements/verification'
import { loadRecordedPageSpeedCoverage } from '../../recorded-performance'

const localDatabase = process.env.PROGRESSIVE_PROJECTION_DB_REQUIRED === 'true' ? describe : describe.skip
localDatabase('bounded PostgreSQL completion projection', () => {
  beforeAll(() => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
  })
  it('assembles page findings and gaps without transferring retained assertion and flow receipts', async () => {
    const url = 'https://example.com/', metadata = parseMetadataFromHtml('<h1>Recorded page</h1>', url)
    const audit = await prisma.audit.create({ data: { url, status: 'CHECKING' } })
    try {
      const input = { pageUrl: url, position: 0, primary: true, role: 'primary' }
      const page = await prisma.auditPage.create({ data: { auditId: audit.id, url, normalizedUrl: url, position: 0, role: 'primary' } })
      const flag = { checkId: 'axe-control-names', pageUrl: url, rubric: 'EXPERIENCE' as const, severity: 'IMPORTANT' as const,
        problem: 'Recorded control has no name', evidence: 'Recorded native control observation', fix: 'Name the control',
        confidence: 1, source: 'DETERMINISTIC' as const }
      // Schema-valid retained observations model a large native receipt. This
      // fixture proves summary transfer and custody, not website collection.
      const receipt = { kind: 'site-module-check' as const, version: 1 as const, module: 'accessibility', pageUrl: url,
        applicable: true, passed: false, complete: false, assertions: Array.from({ length: 120 }, (_, index) => ({
          key: 'automated-accessibility', name: 'Recorded control name', passed: false, complete: index === 0,
          expected: 'Native observation context. '.repeat(65), observed: 'Retained native target detail. '.repeat(60),
          targets: Array.from({ length: 8 }, (_, target) => ({ selector: '#control-' + index + '-' + target + '-'.repeat(1400), label: 'Recorded control' })),
        })) }
      const checked = serializeArtifact('check', checkArtifactSchema.parse({ flags: [flag], receipt }))
      const flowFlag = { ...flag, checkId: 'flow-cta-click-failed', problem: 'Recorded action could not activate' }
      const flow = serializeArtifact('flow', { flags: [flowFlag], networkReceipt: { ...receipt, module: 'network',
        assertions: receipt.assertions.map(assertion => ({ ...assertion, key: 'engagement-observation' })) },
        result: { status: 'unclickable', steps: [], finalUrl: url, ctaText: 'Continue', ctaHref: null } })
      actionHandlers.find(handler => handler.kind === 'flow')!.validateResult?.(flow)
      const browser = serializeArtifact('browser', { pageId: page.id, metadata,
        snapshot: { desktopUrl: null, mobileUrl: null, desktopBase64: null, mobileBase64: null,
          desktopHtml: '<h1>Recorded page</h1>', consoleErrors: [], captureStatus: { desktop: 'ok', mobile: 'pending' }, captureFailures: [] } })
      const tasks = []
      for (const [kind, result] of [['browser', browser], ['check', checked], ['flow', flow]] as const) tasks.push(await prisma.auditExecutionTask.create({
        data: { auditId: audit.id, pageUrl: url, targetKey: 'task:p0:' + kind, source: 'EXECUTION',
          workKind: kind, workState: 'COMPLETED', status: 'COMPLETED', workInput: input, workResult: result },
      }))
      await prisma.auditVerificationReceipt.create({ data: { auditId: audit.id, taskId: tasks[1].id,
        targetKey: 'module:accessibility', scopeKey: 'page:' + url, pageUrl: url, source: 'DETERMINISTIC', status: 'COMPLETED', detail: receipt } })
      const read = vi.fn(prisma.$queryRaw.bind(prisma))
      const pages = await recordedPageEvidence(audit.id, url, { $queryRaw: read })
      expect(pages).toHaveLength(1)
      expect(pages[0]).toMatchObject({ pageId: page.id, url, metadata: { h1s: ['Recorded page'] }, flowScan: true,
        flags: [flag, flowFlag], failedModules: ['accessibility'] })
      const transferred = JSON.stringify(await Promise.all(read.mock.results.map(result => result.value)))
      console.info('Recorded page findings projection', { transferredBytes: Buffer.byteLength(transferred) })
      expect(Buffer.byteLength(transferred)).toBeLessThan(40_000)
      expect(transferred).not.toContain('Retained native target detail.')
      expect(await prisma.auditExecutionTask.findMany({ where: { auditId: audit.id }, orderBy: { targetKey: 'asc' } }))
        .toEqual([...tasks].sort((left, right) => left.targetKey.localeCompare(right.targetKey)))
      expect((await prisma.auditVerificationReceipt.findFirstOrThrow({ where: { auditId: audit.id } })).detail).toEqual(receipt)
      for (const kind of ['check', 'flow', 'journeys', 'cross-page', 'slow-replay']) {
        const invalid = await prisma.auditExecutionTask.create({ data: { auditId: audit.id, pageUrl: url,
          targetKey: 'task:invalid:' + kind, source: 'EXECUTION', workKind: kind, workState: 'COMPLETED', status: 'COMPLETED',
          workInput: input, workResult: { ...checked, kind, data: 'Unreadable retained artifact' } } })
        try { await expect(recordedPageEvidence(audit.id, url)).rejects.toThrow() }
        finally { await prisma.auditExecutionTask.delete({ where: { id: invalid.id } }) }
      }
    } finally { await prisma.audit.delete({ where: { id: audit.id } }) }
  })
  it('projects actual page measurements and retained field data without legacy summaries or raw provider payloads', async () => {
    const url = 'https://example.com/', peer = url + 'pricing'
    const spec = { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: url, environment: 'production', checks: {}, outcomes: [], verificationTarget: null }
    const audit = await prisma.audit.create({ data: { url, executionSpec: spec, pages: { create: [url, peer].map((pageUrl, position) => ({
      url: pageUrl, normalizedUrl: pageUrl, role: position ? 'linked' : 'primary', position,
    })) } }, include: { pages: true } })
    const measured = (strategy: 'desktop' | 'mobile') => ({ strategy, score: 90, lcp: 1200, cls: 0.01, fcp: 800, tbt: 30,
      inp: null, opportunities: [], failedAccessibilityAudits: [], diagnostics: {}, raw: { privateTrace: 'x'.repeat(2_000_000) }, crux: null })
    const mobile = { ...measured('mobile'), score: null, lcp: null, cls: null, fcp: null, tbt: null, inp: 900 }
    const field = serializeArtifact('pagespeed', { desktop: null, mobile, mobileError: 'Lab collection unavailable' })
    try {
      const task = await prisma.auditExecutionTask.create({ data: { auditId: audit.id, pageUrl: url, targetKey: 'task:p0:pagespeed-mobile',
        source: 'EXECUTION', workKind: 'pagespeed', workState: 'BLOCKED', status: 'FAILED',
        workInput: { pageUrl: url, position: 0, primary: true, role: 'primary' }, workResult: field } })
      await prisma.auditExecutionTask.create({ data: { auditId: audit.id, pageUrl: url, targetKey: 'task:p0:pagespeed-desktop',
        source: 'EXECUTION', workKind: 'pagespeed', workState: 'COMPLETED', status: 'COMPLETED',
        workInput: { pageUrl: url, position: 0, primary: true, role: 'primary' },
        workResult: serializeArtifact('pagespeed', { desktop: measured('desktop'), mobile: null }) } })
      const read = vi.fn(prisma.$queryRaw.bind(prisma))
      const observed = await loadRecordedPageSpeedCoverage(audit, { $queryRaw: read } as Pick<typeof prisma, '$queryRaw'>)
      expect(observed).toEqual({ status: 'partial', totalRoutes: 2, observedRoutes: 1,
        missingRoutes: [{ url, missing: ['mobile'] }, { url: peer, missing: ['desktop', 'mobile'] }] })
      expect(Buffer.byteLength(JSON.stringify(await read.mock.results[0].value))).toBeLessThan(1500)
      const pageEvidence = await recordedPageEvidence(audit.id, url)
      expect(pageEvidence[0]).toMatchObject({ mobile: { score: null, inp: 900 },
        mobileError: 'Lab collection unavailable', failedModules: ['pagespeed'] })
      expect(JSON.stringify(pageEvidence)).not.toContain('privateTrace')
      expect((await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: task.id } })).workResult).toEqual(field)
      await prisma.auditExecutionTask.update({ where: { id: task.id }, data: { workState: 'COMPLETED', status: 'COMPLETED',
        workResult: serializeArtifact('pagespeed', { desktop: null, mobile: measured('mobile') }) } })
      expect(await loadRecordedPageSpeedCoverage(audit)).toMatchObject({ status: 'partial', observedRoutes: 1,
        missingRoutes: [{ url: peer, missing: ['desktop', 'mobile'] }] })
      await prisma.auditExecutionTask.create({ data: { auditId: audit.id, pageUrl: peer, targetKey: 'task:p1:pagespeed',
        source: 'EXECUTION', workKind: 'pagespeed', workState: 'COMPLETED', status: 'COMPLETED',
        workInput: { pageUrl: peer, position: 1, primary: false, role: 'linked' },
        workResult: serializeArtifact('pagespeed', { desktop: measured('desktop'), mobile: measured('mobile') }) } })
      expect(await loadRecordedPageSpeedCoverage(audit)).toMatchObject({ status: 'complete', observedRoutes: 2, missingRoutes: [] })
      expect((await prisma.audit.findUniqueOrThrow({ where: { id: audit.id }, include: { pages: true } })).pages.every(page => page.performanceData === null)).toBe(true)
    } finally { await prisma.audit.delete({ where: { id: audit.id } }) }
  })
  it('publishes a new responsibility without transferring or rewriting unrelated historical findings', async () => {
    const pageUrl = 'https://example.com/'
    const audit = await prisma.audit.create({ data: { url: pageUrl, status: 'CHECKING' } })
    const finding = (checkId: string, evidence: string) => ({ checkId, pageUrl, rubric: 'EXPERIENCE', severity: 'IMPORTANT',
      problem: 'Original condition failed', evidence, fix: 'Restore it', confidence: 1, source: 'DETERMINISTIC' })
    const history = Array.from({ length: 8 }, (_, batch) => serializeArtifact('check', { flags: Array.from({ length: 200 }, (_, index) =>
      finding('title-missing', `Independent observation ${batch}:${index}. ` + 'Recorded page evidence. '.repeat(90))) }))
    const context = { audit } as TaskContext
    try {
      await prisma.auditExecutionTask.createMany({ data: history.map((workResult, index) => ({ auditId: audit.id,
        targetKey: 'task:history:' + index, source: 'DETERMINISTIC', status: 'COMPLETED', workState: 'COMPLETED', workKind: 'check', workResult })) })
      await prisma.$transaction(tx => commitFindings(context, serializeArtifact('check', { flags: [finding('title-missing', 'Original title observation')] }), tx))
      const title = await prisma.flag.findFirstOrThrow({ where: { auditId: audit.id, checkId: 'title-missing' } })
      expect((title.supportingObservations as { items: unknown[] }).items).toHaveLength(1601)
      await prisma.$transaction(async tx => {
        const read = vi.fn(tx.$queryRaw.bind(tx))
        const observed = new Proxy(tx, { get(target, key, receiver) { return key === '$queryRaw' ? read : Reflect.get(target, key, receiver) } })
        await commitFindings(context, serializeArtifact('check', { flags: [finding('h1-missing', 'No heading in the captured page')] }), observed)
        const payloads = await Promise.all(read.mock.results.map(result => result.value))
        expect(Buffer.byteLength(JSON.stringify(payloads))).toBeLessThan(4096)
      })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: title.id } })).toEqual(title)
      expect(await prisma.flag.findFirstOrThrow({ where: { auditId: audit.id, checkId: 'h1-missing' } }))
        .toMatchObject({ evidence: 'No heading in the captured page', position: title.position + 1 })
      expect(await recordedTaskFindings(audit.id, prisma)).toHaveLength(1600)
      expect(await prisma.auditExecutionTask.findMany({ where: { auditId: audit.id }, orderBy: { targetKey: 'asc' }, select: { workResult: true } }))
        .toEqual(history.map(workResult => ({ workResult })))
    } finally { await prisma.audit.delete({ where: { id: audit.id } }) }
  })

  it('selects historical journey aliases and split page identities with their original provenance', async () => {
    const pageUrl = 'https://example.com/'
    const audit = await prisma.audit.create({ data: { url: pageUrl, status: 'CHECKING' } })
    const flag = (checkId: string) => ({ checkId, pageUrl, rubric: 'EXPERIENCE', severity: 'IMPORTANT',
      problem: 'Recorded condition', evidence: checkId, fix: 'Restore it', confidence: 1, source: 'DETERMINISTIC' })
    try {
      const task = await prisma.auditExecutionTask.create({ data: { auditId: audit.id, targetKey: 'task:original', source: 'DETERMINISTIC',
        status: 'COMPLETED', workState: 'COMPLETED', workKind: 'check', workResult: serializeArtifact('check', { flags: [
          flag('journey-signup-hidden-cta::page:one'), flag('journey-pricing-evaluation-hidden-cta'), flag('journey-signup-dead-end'), flag('title-missing'),
        ] }) } })
      const rows = await recordedTaskFindings(audit.id, prisma, undefined, ['journey-hidden-cta'])
      expect(rows.map(row => row.checkId)).toEqual(['journey-signup-hidden-cta::page:one', 'journey-pricing-evaluation-hidden-cta'])
      expect(rows.every(row => row.supportingObservations.items[0].provenance?.taskId === task.id)).toBe(true)
      expect((await recordedTaskFindings(audit.id, prisma, undefined, ['journey-dead-end'])).map(row => row.checkId)).toEqual(['journey-signup-dead-end'])
      expect(await recordedTaskFindings(audit.id, prisma, undefined, [])).toEqual([])
    } finally { await prisma.audit.delete({ where: { id: audit.id } }) }
  })

  it('reads repair verdicts without loading collector journals or task diagnostics', async () => {
    const owner = await prisma.user.create({ data: { email: randomUUID() + '@example.test' } })
    const project = await prisma.project.create({ data: { userId: owner.id, name: 'Compact verification', url: 'https://example.com/', canonicalHost: 'example.com' } })
    const before = await prisma.audit.create({ data: { projectId: project.id, url: project.url, status: 'COMPLETED' } })
    const after = await prisma.audit.create({ data: { projectId: project.id, parentId: before.id, url: project.url, status: 'COMPLETED',
      verificationReceipts: { create: [
        ...['check:title-missing', 'module:metadata', 'ai:retained-fingerprint'].map(targetKey => ({
          targetKey, source: 'DETERMINISTIC', status: 'COMPLETED' as const, detail: { observation: 'Retained verdict' },
        })),
        { targetKey: 'artifact:flow-control', source: 'DETERMINISTIC', status: 'COMPLETED', detail: { collector: 'x'.repeat(2_000_000) } },
        { targetKey: 'artifact:observation', source: 'EXECUTION', status: 'COMPLETED', detail: { collector: 'x'.repeat(2_000_000) } },
        { targetKey: 'intent:observation-cohort', source: 'EXECUTION', status: 'COMPLETED', detail: { members: ['x'.repeat(2_000_000)] } },
      ] }, executionTasks: { create: { targetKey: 'task:collector', source: 'DETERMINISTIC', status: 'COMPLETED',
        detail: { diagnostic: 'x'.repeat(100_000) } } },
    } })
    const read = vi.spyOn(prisma.audit, 'findUnique')
    try {
      await expect(reconcileImprovementVerification({ parentAuditId: before.id, verificationAuditId: after.id })).resolves.toEqual([])
      const index = read.mock.calls.findIndex(([input]) => input.where.id === after.id)
      expect(index).toBeGreaterThanOrEqual(0)
      const projected = await read.mock.results[index].value as unknown as { verificationReceipts: Array<{ targetKey: string }> }
      expect(projected.verificationReceipts.map(row => row.targetKey).sort()).toEqual(['ai:retained-fingerprint', 'check:title-missing', 'module:metadata'])
      expect(Buffer.byteLength(JSON.stringify(projected))).toBeLessThan(4096)
    } finally {
      read.mockRestore()
      await prisma.audit.deleteMany({ where: { projectId: project.id } })
      await prisma.project.delete({ where: { id: project.id } })
      await prisma.user.delete({ where: { id: owner.id } })
    }
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
      await prisma.auditExecutionTask.create({ data: { auditId: audit.id, targetKey: 'task:initial', source: 'DETERMINISTIC',
        status: 'COMPLETED', workState: 'COMPLETED', workKind: 'check', workResult: initial } })
      const healthyTask = await prisma.auditExecutionTask.create({ data: { auditId: audit.id, targetKey: 'task:healthy', source: 'DETERMINISTIC',
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
      expect(await prisma.auditVerificationReceipt.findFirstOrThrow({ where: { auditId: audit.id, targetKey: 'module:slop' } }))
        .toMatchObject({ detail: healthyReceipt })
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: broad.id } })).toEqual(broad)
      const rootSpecific = serializeArtifact('check', { flags: [finding('h1-missing', root)] })
      await prisma.$transaction(tx => commitFindings(context, rootSpecific, tx))
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: broad.id } })).toMatchObject({ pageUrl: pricing, affectedPaths: [pricing] })
      const specific = await prisma.flag.findFirstOrThrow({ where: { auditId: audit.id, checkId: 'h1-missing' } })
      await prisma.auditExecutionTask.create({ data: { auditId: audit.id, targetKey: 'task:root', source: 'DETERMINISTIC',
        status: 'COMPLETED', workState: 'COMPLETED', workKind: 'check', workResult: rootSpecific } })
      await prisma.$transaction(tx => commitFindings(context, serializeArtifact('check', { flags: [finding('h1-missing', pricing)] }), tx))
      expect(await prisma.flag.findMany({ where: { auditId: audit.id } })).toEqual([
        expect.objectContaining({ id: specific.id, checkId: 'h1-missing', affectedPaths: [pricing, root] }),
      ])
      expect(await prisma.auditExecutionTask.findFirstOrThrow({ where: { auditId: audit.id, targetKey: 'task:initial' } }))
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
        await prisma.auditExecutionTask.create({ data: { auditId: audit.id, targetKey: 'task:initial', source: 'DETERMINISTIC',
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
      await prisma.auditExecutionTask.create({ data: { auditId: audit.id, targetKey: 'task:root', source: 'DETERMINISTIC',
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
      await prisma.auditExecutionTask.create({ data: { auditId: audit.id, targetKey: 'task:pricing', source: 'DETERMINISTIC',
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
      await tx.$executeRaw`CREATE TEMP TABLE audit_execution_tasks (
        "id" text, "auditId" text, "pageUrl" text, "targetKey" text, "workKind" text,
        "workState" text, "status" text, "workInput" jsonb, "workResult" jsonb, "createdAt" timestamp,
        "detail" jsonb, "evidenceReference" jsonb
      ) ON COMMIT DROP`
      await tx.$executeRaw`CREATE TEMP TABLE audit_verifier_executions (
        "id" text, "auditId" text, "pageUrl" text, "targetKey" text, "status" text,
        "taskId" text, "detail" jsonb, "evidenceReference" jsonb, "createdAt" timestamp DEFAULT now()
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
        await tx.$executeRaw`INSERT INTO audit_execution_tasks
          ("id", "auditId", "pageUrl", "targetKey", "workKind", "workState", "status", "workInput", "workResult", "createdAt") VALUES (
          ${kind}, 'audit', ${url}, ${'task:p0:' + kind}, ${kind}, 'COMPLETED', 'COMPLETED', ${input}::jsonb, ${result}::jsonb, now())`
      }
      const pages = await recordedPages('audit', undefined, tx)
      expect(pages).toHaveLength(1)
      expect(pages[0]).toMatchObject({ pageId: 'page', url, metadata: { title: 'Projected page' },
        desktopScreenshot: false, flags: [flag, journeyFlag], failedModules: [] })
      const gap = JSON.stringify({ complete: false }), reference = JSON.stringify({ taskId: 'check' })
      await tx.$executeRaw`INSERT INTO audit_verifier_executions ("id", "auditId", "pageUrl", "targetKey", "status", "detail", "evidenceReference", "taskId")
        VALUES ('gap', 'audit', 'https://example.com/redirected', 'module:performance', 'COMPLETED', ${gap}::jsonb, ${reference}::jsonb, 'check'),
          ('inapplicable', 'audit', ${url}, 'module:mobile', 'NOT_APPLICABLE', ${gap}::jsonb, ${reference}::jsonb, 'check')`
      const partial = await recordedPages('audit', url, tx)
      expect(partial).toHaveLength(1)
      expect(partial[0]).toMatchObject({ flags: [flag, journeyFlag], failedModules: ['performance'], metadata: { title: 'Projected page' } })
      expect(await recordedPages('audit', 'https://example.com/other', tx)).toEqual([])
      await tx.$executeRaw`UPDATE audit_execution_tasks SET "workResult" = jsonb_set("workResult", '{data,metadata}', 'null'::jsonb)
        WHERE "workKind" IN ('browser', 'http')`
      const independent = await recordedPageEvidence('audit', url, tx)
      expect(independent).toHaveLength(1)
      expect(independent[0]).toMatchObject({ url, primary: true, metadata: null,
        navigation: { linkBaseUrl: url + 'docs/', links: [{ href: 'pricing', text: 'Pricing' }], complete: true },
        preview: { title: 'Native preview', titleComplete: true }, flags: [flag, journeyFlag], failedModules: ['performance'] })
      expect(JSON.stringify(independent)).not.toContain('unprojected')
      expect(await recordedPages('audit', url, tx)).toEqual([])
      await tx.$executeRaw`UPDATE audit_execution_tasks SET "workResult" = jsonb_set("workResult", '{data,metadataFailure}',
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
