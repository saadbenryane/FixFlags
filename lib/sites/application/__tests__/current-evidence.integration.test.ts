import { randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as accountSettings from '@/lib/sites/accounts/store'
import * as connectionViews from '@/lib/sites/connections/read'
import { prisma } from '@/lib/db'
import { loadSiteHome } from '../queries'
import { loadSiteCheckResultPage } from '../check-results'
import { loadCategoryEvidence } from '../category-evidence'
import { loadSiteSummaries } from '../list-sites'
import { getOwnedRun } from '../run-queries'
import { setProjectWatch } from '../monitoring-settings'
import { loadSiteOutcomeDetail } from '../outcome-queries'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { fixedClock } from '@/lib/time/clock'
import { CHECK_REGISTRY } from '@/lib/audit/check-registry'
import { persistFlagDiffSummary } from '@/lib/audit/diff-flags'
import { initialTaskPlan } from '@/lib/audit/progressive/graph'
import { executionSpecSchema } from '@/lib/sites/domain/execution-spec'
import { observationsForFlag } from '@/lib/audit/flag-observations'
import { classifyWatchResult } from '@/lib/audit/project-watch'
import { readSiteHomeView } from '@/lib/sites/site-view-contract'
import { loadSiteFlagDetail, loadSiteFindings } from '@/lib/sites/flags'
import { publishProgress } from '@/lib/audit/progressive/events'
import { readSiteEvents, loadExecutionProgress } from '../execution-progress'
import type { SiteRecord } from '@/lib/sites/types'
import { cardExecution } from '@/lib/sites/card-execution'
import { evaluateSearch } from '@/lib/audit/search/registry'
import { document, evidence } from '@/lib/audit/search/__tests__/fixtures'
import { loadSiteNotificationSummaries } from '../list-sites'
import { buildSummaryPayload } from '@/lib/notifications/summary'
import { NOTIFICATIONS_COPY } from '@/lib/marketing/copy/notifications'
import { healthyDesktopPs, pageSpeedMeasurementFixture } from '@/lib/audit/__tests__/check-fixtures'
import { runPerformanceChecks } from '@/lib/audit/checks/performance'
import { scopePerformanceAssertions } from '@/lib/audit/performance-measurement'

const run = process.env.DEFAULT_MONITORING_DB_REQUIRED === 'true' ? describe : describe.skip
run('current Site evidence publication in PostgreSQL', () => {
  let userId: string, projectId: string, auditId: string, runId: string
  beforeEach(async () => {
    const target = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(target.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(target.pathname))
      throw new Error('Use the disposable execution verifier')
    userId = 'current-evidence-' + randomUUID()
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test' } })
    const project = await prisma.project.create({ data: { userId, name: 'Publication fixture', url: 'https://example.com/',
      canonicalHost: 'example.com', accountChecksEnabled: false, notificationLevel: 'OFF' } })
    projectId = project.id
    const executionSpec = { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: project.url,
      environment: 'production', checks: { 'no-https': 1 }, outcomes: [], verificationTarget: null }
    // Finalization stores completion before its idempotent findings projection.
    // This is its interruption boundary, not proof of webpage collection.
    const audit = await prisma.audit.create({ data: { projectId, userId, url: project.url, status: 'COMPLETED',
      completedAt: new Date(), reportCompleteness: 'FULL', executionSpec, evidenceCoverage: {},
      pages: { create: { url: project.url, normalizedUrl: project.url, status: 'COMPLETED', role: 'homepage', position: 0 } },
      verificationReceipts: { create: { targetKey: 'module:security', scopeKey: 'page:' + project.url,
        pageUrl: project.url, source: 'DETERMINISTIC', status: 'COMPLETED', detail: {
          kind: 'site-module-check', version: 1, module: 'security', pageUrl: project.url, applicable: true, passed: true, complete: true,
          assertions: ['https', 'image-transport'].map(key => ({ key, name: key, expected: 'Safe', observed: 'Observed', passed: true, complete: true })),
        } } } } })
    auditId = audit.id
    const request = await prisma.runRequest.create({ data: { projectId, auditId, requestedByUserId: userId,
      source: 'WEB', idempotencyKey: randomUUID(), executionSpec, status: 'COMPLETED', completedAt: new Date() } })
    runId = request.id
  })
  afterEach(async () => {
    await prisma.audit.deleteMany({ where: { userId } })
    await prisma.user.deleteMany({ where: { id: userId } })
  })

  it.each(['bound', 'unbound'] as const)('selects current %s findings before reading historical editor prompts', async kind => {
    const paths = Array.from({ length: 24 }, (_, index) => 'https://example.com/page-' + index)
    const prompt = 'Restore a descriptive title on the recorded page while preserving its current meaning.'
    const historicalPrompt = 'Recorded historical editor instructions. '.repeat(512)
    const ids = Array.from({ length: 120 }, () => randomUUID())
    // These rows model accumulated observations, not 120 executed browser checks.
    await prisma.flag.createMany({ data: ids.map((id, index) => ({ id, auditId, checkId: 'title-missing', fingerprint: 'title-history',
      source: 'DETERMINISTIC', rubric: 'REACH', severity: 'IMPORTANT', impactTag: 'SEO', confidence: 1, position: index,
      problem: 'Page title is missing', evidence: 'No title was recorded.', whyItMatters: 'The page needs an identifiable title.',
      fix: '', agentPrompt: index === ids.length - 1 ? prompt : historicalPrompt,
      pageUrl: paths[index % paths.length], affectedPaths: index === ids.length - 1 ? paths : [paths[index % paths.length]],
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)) })) })
    if (kind === 'bound') {
      const improvement = await prisma.improvement.create({ data: { projectId, fingerprint: 'title-history', title: 'Restore page titles',
        judgment: 'Recorded title absence.', expectedBenefit: 'Identify each page.', recommendedChange: prompt, successCondition: 'The title is present.' } })
      await prisma.improvementOccurrence.createMany({ data: ids.map(flagId => ({ improvementId: improvement.id, auditId, flagId, kind: 'CONFIRMED' })) })
    }
    const site = (await loadSiteRecord(projectId))!
    const readFlags = prisma.flag.findMany.bind(prisma.flag), readImprovements = prisma.improvement.findMany.bind(prisma.improvement)
    let bytes = 0
    const flagsRead = vi.spyOn(prisma.flag, 'findMany').mockImplementation(async args => {
      const rows = await readFlags(args); bytes += Buffer.byteLength(JSON.stringify(rows)); return rows
    })
    const improvementsRead = vi.spyOn(prisma.improvement, 'findMany').mockImplementation(async args => {
      const rows = await readImprovements(args); bytes += Buffer.byteLength(JSON.stringify(rows)); return rows
    })
    try {
      const findings = await loadSiteFindings(site)
      expect(findings.flags).toHaveLength(1)
      expect(findings.flags[0]).toMatchObject({ sourceFlagId: ids.at(-1), affectedPageCount: paths.length,
        fix: prompt, repairGuidance: 'ready', verificationState: 'still_open' })
      expect(new Set(findings.flags[0].affectedPaths)).toEqual(new Set(paths))
      expect(findings.recommendations).toHaveLength(0)
      process.stdout.write(JSON.stringify({ scenario: kind, syntheticObservations: ids.length, selectedFindings: findings.flags.length, transferredBytes: bytes }) + '\n')
      expect(bytes).toBeLessThan(300_000)
    } finally { flagsRead.mockRestore(); improvementsRead.mockRestore() }
    expect(await prisma.flag.count({ where: { id: { in: ids } } })).toBe(ids.length)
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: ids[0] } })).toMatchObject({ agentPrompt: historicalPrompt, status: 'OPEN', resolvedInId: null })
  })

  it.each(['bound', 'unbound'] as const)('loads supporting evidence only for selected %s account-summary findings', async kind => {
    const paths = Array.from({ length: 24 }, (_, index) => 'https://example.com/page-' + index)
    const history = Array.from({ length: 120 }, (_, index) => ({ id: randomUUID(), flagId: randomUUID(),
      pageUrl: paths[index % paths.length], at: new Date(Date.now() - (120 - index) * 60_000) }))
    // Synthetic retained captures exercise summary reads, not webpage collection.
    await prisma.audit.createMany({ data: history.map(row => ({ id: row.id, projectId, userId, url: row.pageUrl,
      status: 'COMPLETED' as const, createdAt: row.at, completedAt: row.at,
      executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: row.pageUrl,
        environment: 'production', checks: { 'title-missing': 1 }, outcomes: [], verificationTarget: null } })) })
    await prisma.flag.createMany({ data: history.map((row, index) => ({ id: row.flagId, auditId: row.id,
      checkId: 'title-missing', fingerprint: 'summary-title-history', source: 'DETERMINISTIC', rubric: 'REACH',
      severity: 'IMPORTANT', confidence: 1, position: 0, createdAt: row.at, pageUrl: row.pageUrl,
      affectedPaths: index === history.length - 1 ? paths : [row.pageUrl], problem: 'Page title is missing',
      evidence: 'No page title was recorded.', whyItMatters: 'The page needs an identifiable title.', fix: 'Restore a descriptive page title.',
      supportingObservations: observationsForFlag({ source: 'DETERMINISTIC', checkId: 'title-missing', pageUrl: row.pageUrl,
        evidence: 'No page title was recorded.', evidenceTargets: [{ source: 'measured', kind: 'element', device: 'desktop',
          label: 'Original title', selector: 'title', context: 'retained private comparison context '.repeat(110) }] }) })) })
    if (kind === 'bound') {
      const improvement = await prisma.improvement.create({ data: { projectId, fingerprint: 'summary-title-history', title: 'Restore page titles',
        judgment: 'Recorded title absence.', expectedBenefit: 'Identify each page.', recommendedChange: 'Restore page titles.', successCondition: 'The title is present.' } })
      await prisma.improvementOccurrence.createMany({ data: history.map(row => ({ improvementId: improvement.id, auditId: row.id,
        flagId: row.flagId, kind: 'CONFIRMED', createdAt: row.at })) })
    }
    const home = (await loadSiteHome(projectId, { ownerEvidence: true }))!
    expect(home.flags).toHaveLength(1)
    let bytes = 0
    const readFlags = prisma.flag.findMany.bind(prisma.flag), readImprovements = prisma.improvement.findMany.bind(prisma.improvement)
    const flags = vi.spyOn(prisma.flag, 'findMany').mockImplementation(async args => {
      const rows = await readFlags(args); bytes += Buffer.byteLength(JSON.stringify(rows)); return rows
    })
    const improvements = vi.spyOn(prisma.improvement, 'findMany').mockImplementation(async args => {
      const rows = await readImprovements(args); bytes += Buffer.byteLength(JSON.stringify(rows)); return rows
    })
    try {
      for (const channel of ['board', 'notification'] as const) {
        bytes = 0
        const summaries = channel === 'board' ? await loadSiteSummaries(userId) : await loadSiteNotificationSummaries(userId)
        expect(summaries).toHaveLength(1)
        expect(summaries[0].presentation.flags).toEqual(home.presentation.flags)
        expect(summaries[0].presentation.result).toEqual(home.presentation.result)
        console.info('Account-summary finding history:', { kind, channel, captures: history.length, transferredBytes: bytes })
        expect(bytes).toBeLessThan(150_000)
      }
    } finally { flags.mockRestore(); improvements.mockRestore() }
    expect(await prisma.flag.count({ where: { auditId: { in: history.map(row => row.id) } } })).toBe(history.length)
  })

  it('retains private recovery comparison inputs while narrowing account-summary evidence reads', async () => {
    const url = 'https://example.com/', now = new Date(), recoveryId = randomUUID()
    const measurement = healthyDesktopPs({ lcp: 3000, diagnostics: { measurement: pageSpeedMeasurementFixture(url) } })
    const finding = runPerformanceChecks(measurement, null, url).find(flag => flag.checkId === 'lcp-poor')!
    // Controlled source and recovery receipts prove reader behavior only.
    // They do not claim a fresh lab measurement or provider acceptance.
    const recovery = await prisma.audit.create({ data: { id: recoveryId, projectId, userId, url, parentId: auditId, status: 'COMPLETED',
      createdAt: new Date(now.getTime() - 60_000), completedAt: now,
      executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: url, environment: 'production',
        checks: { 'lcp-poor': 1 }, outcomes: [], verificationTarget: null },
      verificationReceipts: { create: { targetKey: 'module:performance', scopeKey: 'page:' + url, pageUrl: url,
        status: 'COMPLETED', source: 'DETERMINISTIC', detail: { kind: 'site-module-check', version: 1, module: 'performance',
          pageUrl: url, applicable: true, passed: true, assertions: scopePerformanceAssertions(measurement, url,
            [{ key: 'lcp', name: 'LCP', expected: 'At most 2500ms', observed: '1000ms', passed: true, complete: true }]),
          execution: { auditId: recoveryId, taskId: 'speed', checkVersion: 1, source: 'pagespeed-desktop', collectedAt: now.toISOString() } } } } } })
    const source = await prisma.flag.create({ data: { auditId, source: 'DETERMINISTIC', checkId: finding.checkId,
      rubric: finding.rubric, severity: finding.severity, impactTag: finding.impactTag, problem: finding.problem,
      evidence: finding.evidence, whyItMatters: 'Visitors wait for the page content.', fix: 'Improve content loading.', pageUrl: url, confidence: 1, position: 0,
      verificationRule: finding.verificationRule, evidenceTargets: finding.evidenceTargets as Prisma.InputJsonValue,
      status: 'FIXED', resolvedInId: recovery.id } })
    expect((await loadSiteHome(projectId, { ownerEvidence: true }))!.flags).toHaveLength(0)
    for (const summaries of [await loadSiteSummaries(userId), await loadSiteNotificationSummaries(userId)])
      expect(summaries[0].presentation.flags.count).toBe(0)
    await prisma.auditVerificationReceipt.deleteMany({ where: { auditId: recovery.id, targetKey: 'module:performance' } })
    for (const summaries of [await loadSiteSummaries(userId), await loadSiteNotificationSummaries(userId)])
      expect(summaries[0].presentation.flags.count).toBe(1)
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: source.id } })).toEqual(source)
  })

  it('keeps recorded progress readable without decoding historical or oversized execution inputs', async () => {
    const pageUrl = 'https://example.com/'
    const cohort = Array.from({ length: 5000 }, (_, index) => 'form:' + index.toString(16).padStart(64, '0'))
    const input = { pageUrl, position: 0, primary: true, role: 'primary', verificationContexts: cohort }
    const current = await prisma.auditExecutionTask.create({ data: { auditId, targetKey: 'task:cohort-progress', source: 'EXECUTION',
      pageUrl, workKind: 'flow', workState: 'READY', status: 'PENDING', workInput: input } })
    const historical = await prisma.auditExecutionTask.create({ data: { auditId, targetKey: 'task:historical-progress', source: 'EXECUTION',
      workKind: 'check', workState: 'BLOCKED', status: 'FAILED', workErrorCode: 'CHECK_VERSION_UNAVAILABLE',
      workInput: { pageUrl, module: 'metadata', historicalFormat: { retained: 'x'.repeat(2_000_000) } } } })
    const unreadable = await prisma.auditExecutionTask.create({ data: { auditId, targetKey: 'task:unreadable-progress', source: 'EXECUTION',
      workInput: { module: { invalid: true }, device: 'tablet' }, status: 'PENDING' } })
    await prisma.auditExecutionTask.create({ data: { auditId, targetKey: 'task:prescription-progress', source: 'EXECUTION',
      workKind: 'prescription', workState: 'READY', status: 'PENDING', workInput: input } })
    const site = await loadSiteRecord(projectId)
    const read = vi.spyOn(prisma, '$queryRaw')
    try {
      const progress = await loadExecutionProgress(site!, auditId)
      expect(progress).toMatchObject({ total: 3, pending: 1, unknown: 2,
        recovery: { action: 'support', reasons: ['CHECK_VERSION_UNAVAILABLE'] }, tasks: expect.arrayContaining([
          expect.objectContaining({ id: current.id, kind: 'flow', pageUrl, state: 'READY' }),
          expect.objectContaining({ id: historical.id, kind: 'check', module: 'metadata', pageUrl, state: 'BLOCKED' }),
          expect.objectContaining({ id: unreadable.id, kind: '', module: null, device: null, pageUrl: '', state: 'UNKNOWN' }),
        ]) })
      const home = await loadSiteHome(projectId, { ownerEvidence: true })
      expect(readSiteHomeView(JSON.parse(JSON.stringify(home)), projectId).executionProgress).toMatchObject({ total: 3, unknown: 2,
        categoryActivity: { conversion: { kind: 'flow', state: 'READY' } } })
      expect(Buffer.byteLength(JSON.stringify(progress))).toBeLessThan(4096)
      const indexes = read.mock.calls.flatMap(([query], index) =>
        (Array.isArray(query) ? query.join('') : (query as Prisma.Sql).sql).includes('FROM audit_execution_tasks task JOIN audits audit') ? [index] : [])
      expect(indexes).toHaveLength(2)
      for (const index of indexes) expect(Buffer.byteLength(JSON.stringify(await read.mock.results[index].value))).toBeLessThan(4096)
      expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: historical.id } })).toMatchObject({
        workInput: { historicalFormat: { retained: 'x'.repeat(2_000_000) } }, workState: 'BLOCKED',
      })
    } finally { read.mockRestore() }
  })

  it('retains category activity beyond the detail limit through the Site home and client projection', async () => {
    const pageUrl = 'https://example.com/'
    await prisma.audit.update({ where: { id: auditId }, data: { status: 'CHECKING', completedAt: null } })
    await prisma.auditExecutionTask.createMany({ data: Array.from({ length: 120 }, (_, index) => ({
      auditId, targetKey: 'task:earlier:' + index, source: 'EXECUTION', pageUrl, workKind: 'check',
      workState: 'COMPLETED' as const, status: 'COMPLETED' as const, workInput: { module: 'metadata' },
    })) })
    const active = await prisma.auditExecutionTask.create({ data: { auditId, targetKey: 'task:later-performance', source: 'EXECUTION',
      pageUrl, workKind: 'pagespeed', workState: 'RUNNING', status: 'RUNNING', workInput: { device: 'mobile' } } })
    const home = await loadSiteHome(projectId, { ownerEvidence: true })
    const view = readSiteHomeView(JSON.parse(JSON.stringify(home)), projectId)
    expect(view.executionProgress).toMatchObject({ total: 121, running: 1,
      categoryActivity: { performance: { kind: 'pagespeed', state: 'RUNNING', device: 'mobile' } } })
    expect(view.executionProgress?.tasks).toHaveLength(100)
    expect(view.executionProgress?.tasks.some(task => task.id === active.id)).toBe(false)
    expect(cardExecution('performance', view.executionProgress)?.status).toBe('Running')
  })

  it.each(['parent', 'tasks'] as const)('preserves only the provisional primary progress when its source is claimed after the %s read', async phase => {
    const anonymous = await prisma.audit.create({ data: { url: 'https://example.com/' } })
    await prisma.auditExecutionTask.create({ data: { auditId: anonymous.id, targetKey: 'task:provisional', source: 'EXECUTION',
      pageUrl: anonymous.url, workKind: 'browser', workState: 'READY', status: 'PENDING' } })
    const provisional = { siteId: 'provisional-progress', projectId: null, primaryAuditId: anonymous.id } as SiteRecord
    await publishProgress(anonymous.id, { kind: 'browser', state: 'READY' })
    expect((await readSiteEvents(provisional, BigInt(0))).length).toBeGreaterThan(0)
    const claim = () => prisma.audit.update({ where: { id: anonymous.id }, data: { projectId, userId } })
    let restore: () => void
    if (phase === 'parent') {
      const original = prisma.audit.findFirst.bind(prisma.audit)
      const read = vi.spyOn(prisma.audit, 'findFirst').mockImplementationOnce(async input => {
        const parent = await original(input)
        await claim()
        return parent
      })
      restore = () => read.mockRestore()
    } else {
      const original = prisma.auditExecutionTask.groupBy.bind(prisma.auditExecutionTask)
      const read = vi.spyOn(prisma.auditExecutionTask, 'groupBy').mockImplementationOnce(async input => {
        await claim()
        return original(input)
      })
      restore = () => read.mockRestore()
    }
    try {
      expect(await loadExecutionProgress(provisional, anonymous.id)).toMatchObject({ total: 1, pending: 1,
        tasks: [expect.objectContaining({ kind: 'browser', state: 'READY', pageUrl: anonymous.url })] })
      await publishProgress(auditId, { kind: 'browser', state: 'RUNNING' })
      const events = await readSiteEvents(provisional, BigInt(0))
      expect(events.length).toBeGreaterThan(0)
      expect(events.every(event => event.auditId === anonymous.id)).toBe(true)
      expect(await loadExecutionProgress(provisional, auditId)).toBeNull()
    } finally {
      restore()
      await prisma.audit.delete({ where: { id: anonymous.id } })
    }
  })

  it.each(['another-inventory', 'staging-inventory', 'wrong-environment'] as const)(
    'keeps a relevant failed category visible beside a newer %s recheck', async context => {
      const time = Date.now(), url = 'https://example.com/'
      const baseline = await prisma.audit.update({ where: { id: auditId }, data: {
        createdAt: new Date(time - 60_000), completedAt: new Date(time - 50_000),
      } })
      await persistFlagDiffSummary(null, auditId)
      const snapshot = executionSpecSchema.parse({ ...(baseline.executionSpec as object), scope: 'CATEGORY',
        category: { area: 'security', sourceAuditId: auditId, pages: [url] } })
      // Saved interruption state establishes projection behavior, not execution
      // evidence or a claim that these synthetic rechecks visited a website.
      const active = await prisma.audit.create({ data: { projectId, userId, url, parentId: auditId, status: 'FAILED',
        createdAt: new Date(time - 20_000), completedAt: new Date(time - 19_000), failedModules: ['http'], executionSpec: snapshot as Prisma.InputJsonValue } })
      const before = (await loadSiteHome(projectId, { ownerEvidence: true }))!
      expect(before.presentation.categories.find(category => category.id === 'security')).toMatchObject({ state: 'unknown' })
      const summaryBefore = (await loadSiteSummaries(userId))[0]
      let sourceAuditId = auditId
      const environment = context === 'another-inventory' ? 'production' : 'staging'
      if (context !== 'wrong-environment') {
        const other = await prisma.audit.create({ data: { projectId, userId, url, status: 'COMPLETED',
          createdAt: new Date(time - 120_000), completedAt: new Date(time - 110_000),
          executionSpec: { ...(baseline.executionSpec as object), environment } } })
        sourceAuditId = other.id
      }
      const unrelated = await prisma.audit.create({ data: { projectId, userId, url, parentId: sourceAuditId, status: 'FAILED',
        createdAt: new Date(time - 10_000), completedAt: new Date(time - 9000), executionSpec: { ...snapshot, environment,
          category: { ...snapshot.category!, sourceAuditId } } as Prisma.InputJsonValue } })
      expect((await loadCategoryEvidence([{ projectId, auditId }])).map(category => category.id)).toEqual([active.id])
      expect(await loadCategoryEvidence([{ projectId: 'another-site', auditId }])).toEqual([])
      if (context !== 'wrong-environment') {
        const selected = await loadCategoryEvidence([{ projectId, auditId }, { projectId, auditId: sourceAuditId }])
        expect(selected.map(category => category.id).sort()).toEqual([active.id, unrelated.id].sort())
      }
      const home = (await loadSiteHome(projectId, { ownerEvidence: true }))!
      expect(home.presentation.categories.find(category => category.id === 'security'))
        .toEqual(before.presentation.categories.find(category => category.id === 'security'))
      expect((await loadSiteSummaries(userId))[0].presentation.result).toEqual(summaryBefore.presentation.result)
      const results = await loadSiteCheckResultPage(home.site, baseline, undefined, undefined, { area: 'security' }, true)
      expect(results.results.length).toBeGreaterThan(0)
      expect(results.results.every(result => result.auditId === auditId && result.historical)).toBe(true)
      expect(await getOwnedRun(userId, runId)).toMatchObject({ result: 'CLEAR' })
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: active.id } })).toEqual(active)
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: unrelated.id } })).toEqual(unrelated)
    })

  it.each(['QUEUED', 'CHECKING', 'FAILED'] as const)('retains fresh category assurance while the next full-site check is %s', async status => {
    const now = Date.now(), url = 'https://example.com/'
    const baseline = await prisma.audit.update({ where: { id: auditId }, data: {
      createdAt: new Date(now - 10 * 86400_000), completedAt: new Date(now - 9 * 86400_000),
    }, include: { verifierExecutions: { where: { targetKey: 'module:security' } } } })
    await persistFlagDiffSummary(null, auditId)
    const spec = executionSpecSchema.parse({ ...(baseline.executionSpec as object), scope: 'CATEGORY',
      category: { area: 'security', sourceAuditId: auditId, pages: [url] } })
    // Persisted observations isolate reader provenance. They are not fresh
    // webpage collection or provider evidence.
    const category = await prisma.audit.create({ data: { projectId, userId, url, parentId: auditId,
      status: 'COMPLETED', createdAt: new Date(now - 2000), completedAt: new Date(now - 1000), executionSpec: spec,
      pages: { create: { url, normalizedUrl: url, status: 'COMPLETED', role: 'homepage', position: 0 } },
      verificationReceipts: { create: { targetKey: 'module:security', scopeKey: 'page:' + url,
        status: 'COMPLETED', source: 'DETERMINISTIC', detail: baseline.verifierExecutions[0].detail!, updatedAt: new Date(now - 1000) } },
      executionTasks: { create: initialTaskPlan(spec).map(task => ({ targetKey: 'task:' + task.key, scopeKey: task.scope, source: 'SYSTEM' as const,
        status: 'COMPLETED' as const, workState: 'COMPLETED' as const, workKind: task.kind, workDependencies: task.dependencies,
        workInput: task.input, pageUrl: task.input.pageUrl })) } } })
    await persistFlagDiffSummary(auditId, category.id)
    const before = (await loadSiteHome(projectId, { ownerEvidence: true }))!
    expect(before.cards.find(card => card.id === 'security')).toMatchObject({ state: 'healthy', evidenced: true,
      checkedAt: category.completedAt!.toISOString() })
    const current = await prisma.audit.create({ data: { projectId, userId, url, status, createdAt: new Date(now),
      completedAt: status === 'FAILED' ? new Date(now) : null, executionSpec: baseline.executionSpec!, evidenceCoverage: {} } })
    const home = (await loadSiteHome(projectId, { ownerEvidence: true }))!
    const client = readSiteHomeView(JSON.parse(JSON.stringify(home)), projectId)
    for (const view of [home, client]) {
      expect(view.cards.find(card => card.id === 'security')).toMatchObject({ state: 'healthy', evidenced: true,
        checkedAt: category.completedAt!.toISOString() })
      expect(view.presentation.freshness.stale).toBe(false)
      expect(view.audit).toMatchObject({ id: current.id, status })
    }
    expect((await loadSiteSummaries(userId))[0].presentation.freshness.stale).toBe(false)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: category.id } })).toEqual(category)
  })

  it.each(['missing', 'unknown', 'checking', 'offline', 'stale', 'online'] as const)('uses %s uptime evidence for current Site health while preserving the recorded run', async state => {
    const now = new Date()
    await prisma.project.update({ where: { id: projectId }, data: { watchInterval: 'WEEKLY', watchNextRunAt: new Date(now.getTime() + 86400_000) } })
    await prisma.auditVerificationReceipt.create({ data: { auditId, targetKey: 'projection:flag-comparison', scopeKey: 'product',
      status: 'COMPLETED', source: 'SYSTEM', detail: { kind: 'flag-comparison', version: 1, auditId, parentAuditId: null,
        summary: { newIssues: [], unchanged: [], regressed: [], fixed: [], inconclusive: [] } } } })
    if (state !== 'missing') await prisma.uptimeMonitor.create({ data: { projectId, targetUrl: 'https://example.com/',
      state: state === 'stale' ? 'online' : state, lastCheckedAt: new Date(now.getTime() - (state === 'stale' ? 11 * 60_000 : 1000)),
      nextProbeAt: new Date(now.getTime() + 5 * 60_000) } })
    const expected = state === 'online' ? 'clear' : state === 'offline' ? 'flags' : 'could_not_verify'
    const home = (await loadSiteHome(projectId, { ownerEvidence: true }))!
    expect(home.presentation.result.state).toBe(expected)
    expect(readSiteHomeView(JSON.parse(JSON.stringify(home)), projectId).presentation.result.state).toBe(expected)
    const summary = (await loadSiteSummaries(userId))[0]
    expect(summary.presentation.result).toEqual(home.presentation.result)
    if (state === 'offline') expect(home.presentation.result.label).toBe('Offline')
    expect(home.flags).toHaveLength(0)
    expect(home.presentation.flags.count).toBe(0)
    expect(home.monitoringHistory.find(entry => entry.id === auditId)?.result).toBe('CLEAR')
    expect((await getOwnedRun(userId, runId))?.result).toBe('CLEAR')
    expect(await prisma.flag.count({ where: { auditId } })).toBe(0)
  })

  it.each(['pending', 'unavailable'] as const)('retains %s guidance from the finding source rather than the latest broad check', async state => {
    const time = Date.now()
    await prisma.audit.update({ where: { id: auditId }, data: { includeAi: state === 'unavailable',
      triageAt: new Date(time), aiReviewAt: null, failureCode: null } })
    const latest = await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })
    const source = await prisma.audit.create({ data: { userId, projectId, url: latest.url, status: 'COMPLETED',
      includeAi: state === 'pending', triageAt: new Date(time - 30_000), aiReviewAt: null,
      completedAt: new Date(time - 20_000), createdAt: new Date(time - 30_000) } })
    const flag = await prisma.flag.create({ data: { auditId: source.id, source: 'DETERMINISTIC', checkId: 'buttons-no-text',
      fingerprint: 'source-guidance', rubric: 'EXPERIENCE', severity: 'IMPORTANT', confidence: 1, position: 0,
      problem: 'A button has no accessible name', evidence: 'Recorded unnamed button', whyItMatters: 'Its action is unclear',
      fix: '', pageUrl: latest.url } })
    if (state === 'pending') {
      const improvement = await prisma.improvement.create({ data: { projectId, fingerprint: flag.fingerprint,
        title: flag.problem, judgment: flag.evidence, expectedBenefit: flag.whyItMatters,
        recommendedChange: '', successCondition: 'The original button has an accessible name' } })
      await prisma.improvementOccurrence.create({ data: { improvementId: improvement.id, auditId: source.id, flagId: flag.id, kind: 'OBSERVED' } })
    }
    const home = (await loadSiteHome(projectId, { ownerEvidence: true }))!
    expect(home.flags.find(item => item.sourceFlagId === flag.id)?.repairGuidance).toBe(state)
    expect((await loadSiteFlagDetail(home.site, flag.id))?.repairGuidance).toBe(state)
    expect(readSiteHomeView(JSON.parse(JSON.stringify(home)), projectId).flags.find(item => item.sourceFlagId === flag.id)?.repairGuidance).toBe(state)
    let newerFlagId: string | null = null
    if (state === 'pending') {
      const newer = await prisma.flag.create({ data: { auditId, source: 'DETERMINISTIC', checkId: flag.checkId,
        fingerprint: flag.fingerprint, rubric: 'EXPERIENCE', severity: 'IMPORTANT', confidence: 1, position: 0,
        problem: 'The current button needs a label', evidence: 'A newer recorded occurrence', whyItMatters: flag.whyItMatters,
        fix: 'Guidance for the newer occurrence.', pageUrl: latest.url } })
      newerFlagId = newer.id
      expect((await loadSiteHome(projectId, { ownerEvidence: true }))!.flags.some(item => item.sourceFlagId === flag.id)).toBe(false)
      expect((await loadSiteFlagDetail(home.site, flag.id))?.repairGuidance).toBe('pending')
    }
    await prisma.flag.update({ where: { id: flag.id }, data: { fix: 'Give the original button a clear accessible name.' } })
    await prisma.audit.update({ where: { id: source.id }, data: { aiReviewAt: new Date() } })
    await publishProgress(source.id, { kind: 'prescription', state: 'COMPLETED', taskId: 'controlled-prescription' })
    const other = await prisma.project.create({ data: { userId, name: 'Other private Site', url: 'https://other.example/', canonicalHost: 'other.example' } })
    const foreign = await prisma.audit.create({ data: { userId, projectId: other.id, url: other.url, status: 'COMPLETED' } })
    await publishProgress(foreign.id, { kind: 'prescription', state: 'COMPLETED', taskId: 'foreign-prescription' })
    const notices = await readSiteEvents(home.site, BigInt(0))
    expect(notices).toMatchObject([{ auditId: source.id, detail: { kind: 'prescription', state: 'COMPLETED' } }])
    expect(notices.some(notice => notice.auditId === foreign.id)).toBe(false)
    expect((await loadSiteHome(projectId, { ownerEvidence: true }))!.flags.find(item => item.sourceFlagId === (newerFlagId ?? flag.id))?.repairGuidance).toBe('ready')
    expect(await loadSiteFlagDetail(home.site, flag.id)).toMatchObject({ repairGuidance: 'ready', fix: 'Give the original button a clear accessible name.' })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toEqual(latest)
  })

  it('isolates overview refresh from settings-only reads and reuses supplied connection evidence', async () => {
    const accountRead = vi.spyOn(accountSettings, 'loadAccountChecksView').mockRejectedValue(new Error('Controlled settings read failure'))
    const connectionRead = vi.spyOn(connectionViews, 'loadSiteConnectionViews').mockRejectedValue(new Error('Duplicate connection read'))
    try {
      const site = (await loadSiteRecord(projectId))!
      const home = await loadSiteHome(projectId, { site, ownerEvidence: true, connections: Promise.resolve(null) })
      expect(home?.readScope).toBe('overview')
      expect(home?.settings.accountChecks).toBeUndefined()
      expect(home?.settings.github).toBeUndefined()
      expect(accountRead).not.toHaveBeenCalled()
      expect(connectionRead).not.toHaveBeenCalled()
      await expect(loadSiteHome(projectId, { site, ownerEvidence: true, readScope: 'settings', connections: Promise.resolve(null) }))
        .rejects.toThrow('Controlled settings read failure')
      expect(accountRead).toHaveBeenCalledWith(projectId)
      await expect(loadSiteHome('different-site', { site, ownerEvidence: true })).rejects.toThrow('identity mismatch')
    } finally { accountRead.mockRestore(); connectionRead.mockRestore() }
  })

  it('withholds Clear consistently until the comparison belongs to this completed execution', async () => {
    async function expectState(state: 'clear' | 'could_not_verify') {
      const outcome = state === 'clear' ? 'CLEAR' : 'COULD_NOT_VERIFY'
      expect(await getOwnedRun(userId, runId)).toMatchObject({ result: outcome })
      const home = await loadSiteHome(projectId, { ownerEvidence: true })
      expect(home?.presentation.result.state).toBe(state)
      expect(home?.monitoringHistory.find(entry => entry.id === auditId)).toMatchObject({
        result: outcome, completionState: state === 'clear' ? 'COMPLETED' : 'PARTIAL',
      })
      expect((await loadSiteSummaries(userId))[0].presentation.result.state).toBe(state)
    }
    const before = await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })
    await expectState('could_not_verify')
    expect(await prisma.auditVerificationReceipt.count({ where: { auditId, targetKey: 'projection:flag-comparison' } })).toBe(0)
    const summary = { newIssues: [], unchanged: [], regressed: [], fixed: [], inconclusive: [] }
    const receipt = await prisma.auditVerificationReceipt.create({ data: { auditId, targetKey: 'projection:flag-comparison', scopeKey: 'product',
      status: 'COMPLETED', source: 'SYSTEM', detail: { kind: 'flag-comparison', version: 1, auditId: 'different-audit', parentAuditId: null, summary } } })
    await expectState('could_not_verify')
    await prisma.auditVerificationReceipt.update({ where: { id: receipt.id }, data: {
      detail: { kind: 'flag-comparison', version: 1, auditId, parentAuditId: null, summary },
    } })
    await expectState('clear')
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toEqual(before)
    expect(await prisma.flag.count({ where: { auditId } })).toBe(0)
  })

  it('retains a Pages finding in its category conclusion despite complete page collection', async () => {
    await prisma.flag.create({ data: { auditId, source: 'AI', rubric: 'CLARITY', severity: 'IMPORTANT',
      problem: 'The page heading contradicts its stated purpose.', evidence: 'Recorded conflicting heading and page introduction.',
      whyItMatters: 'Visitors cannot identify the page purpose.', fix: 'Align the heading with the page purpose.',
      confidence: 0.9, position: 0, pageUrl: 'https://example.com/' } })
    const home = await loadSiteHome(projectId, { ownerEvidence: true })
    expect(home?.presentation.coverage.complete).toBe(true)
    expect(home?.counts.categories.site).toBe(1)
    expect(home?.presentation.categories.find(category => category.id === 'site')).toMatchObject({
      state: 'problem', status: 'Needs a fix', flagCount: 1,
    })
  })

  it('keeps another page’s unavailable Search source incomplete across current Site and notification views', async () => {
    const now = new Date(), root = 'https://example.com/', about = root + 'about'
    const html = '<html lang="en"><head><title>Recorded title</title></head><body><h1>Recorded page</h1></body></html>'
    const readTitle = async (url: string, available: boolean) => {
      const source = document(available ? html : null, { url, finalUrl: url, collectedAt: now.toISOString(),
        complete: available, reason: available ? null : 'document_truncated' })
      const observations = (await evaluateSearch(evidence(html, { auditId, pageUrl: url, collectorVersion: 2,
        collectedAt: now.toISOString(), original: source, rendered: source }), null, ['presentation']))
        .filter(item => item.checkId === 'title-missing')
      expect(observations.length).toBeGreaterThan(0)
      expect(observations.every(item => item.disposition === (available ? 'passed' : 'unknown'))).toBe(true)
      return { kind: 'search-checks', version: 1, auditId, pageUrl: url, collectedAt: now.toISOString(),
        complete: available, observations }
    }
    const baseline = await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })
    await prisma.audit.update({ where: { id: auditId }, data: {
      executionSpec: { ...(baseline.executionSpec as Prisma.JsonObject), checks: { 'title-missing': 2 } },
    } })
    await prisma.auditPage.create({ data: { auditId, url: about, normalizedUrl: about, status: 'COMPLETED', role: 'internal', position: 1 } })
    // These are actual parser observations on supplied documents. The fixture
    // exercises persisted projection, not HTTP or browser collection.
    for (const [url, available] of [[root, true], [about, false]] as const) {
      await prisma.auditVerificationReceipt.create({ data: { auditId, targetKey: 'module:search', scopeKey: 'page:' + url,
        pageUrl: url, source: 'DETERMINISTIC', status: 'COMPLETED', detail: await readTitle(url, available) as Prisma.InputJsonValue } })
    }
    await persistFlagDiffSummary(null, auditId)
    const before = await prisma.auditVerificationReceipt.findMany({ where: { auditId }, orderBy: { id: 'asc' } })
    const home = (await loadSiteHome(projectId, { ownerEvidence: true }))!
    const list = (await loadSiteSummaries(userId))[0]
    const notification = (await loadSiteNotificationSummaries(userId, now))[0]
    expect(home.cards.find(card => card.id === 'search')).toMatchObject({ state: 'unknown', incompleteReason: expect.any(String) })
    expect(home.presentation.categories.find(category => category.id === 'search')).toMatchObject({ state: 'unknown' })
    expect(home.presentation.result.state).toBe('could_not_verify')
    expect(list.presentation.result).toEqual(home.presentation.result)
    expect(notification.notification.incomplete).toBe(true)
    expect(readSiteHomeView(JSON.parse(JSON.stringify(home)), projectId).cards.find(card => card.id === 'search')?.state).toBe('unknown')
    expect(await prisma.auditVerificationReceipt.findMany({ where: { auditId }, orderBy: { id: 'asc' } })).toEqual(before)
  })

  it.each(['malformed', 'public-only', 'empty-array'] as const)('keeps %s supporting evidence unknown across current views, publication and history', async kind => {
    const supportingObservations = kind === 'malformed' ? { version: 99, items: [] } : kind === 'empty-array' ? []
      : [{ source: 'DETERMINISTIC', checkId: 'no-https', checkVersion: 1, pageUrl: 'https://example.com/', evidence: 'Public summary',
        recordedAt: new Date().toISOString(), references: [] }]
    const flag = await prisma.flag.create({ data: { auditId, source: 'DETERMINISTIC', rubric: 'REACH', severity: 'IMPORTANT',
      checkId: 'no-https', problem: 'Recorded grouped finding', evidence: 'The original grouping is unavailable.',
      whyItMatters: 'Its source observations need inspection.', fix: 'Retained original guidance.', confidence: 1, position: 0,
      pageUrl: 'https://example.com/', supportingObservations } })
    await persistFlagDiffSummary(null, auditId)
    const home = await loadSiteHome(projectId, { ownerEvidence: true })
    expect(home?.flags).toHaveLength(0)
    expect(home?.recommendations.find(item => item.sourceFlagId === flag.id)).toMatchObject({ supportingEvidenceUnreadable: true })
    expect(home?.recommendations.find(item => item.sourceFlagId === flag.id)).toMatchObject({ fix: '', repairGuidance: 'unavailable' })
    expect(readSiteHomeView(JSON.parse(JSON.stringify(home)), projectId).recommendations[0].supportingEvidenceUnreadable).toBe(true)
    expect(home?.presentation.result.state).toBe('could_not_verify')
    expect((await loadSiteSummaries(userId))[0].presentation.result.state).toBe('could_not_verify')
    expect(await getOwnedRun(userId, runId)).toMatchObject({ result: 'COULD_NOT_VERIFY', completionState: 'PARTIAL' })
    expect(home?.monitoringHistory.find(entry => entry.id === auditId)).toMatchObject({ result: 'COULD_NOT_VERIFY', flagCount: 0, completionState: 'PARTIAL' })
    const publication = await prisma.auditVerificationReceipt.findFirstOrThrow({ where: { auditId, targetKey: 'projection:flag-comparison' } })
    expect(publication.detail).toMatchObject({ summary: { newIssues: [{ id: flag.id, supportingEvidenceUnreadable: true }] } })
    expect(JSON.stringify(publication.detail)).not.toContain('supportingObservations')
    await prisma.project.update({ where: { id: projectId }, data: { notificationLevel: 'FLAGS', notifyOnRecovery: true } })
    await prisma.audit.update({ where: { id: auditId }, data: { recheckTrigger: 'WATCH' } })
    await classifyWatchResult(null, auditId)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toMatchObject({
      watchRegressionCount: 0, watchRecoveryCount: 0, watchNotificationStatus: 'NOT_APPLICABLE',
    })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toEqual(flag)
  })

  it.each(['native', 'legacy'] as const)('retains a genuine recorded finding with %s supporting evidence', async kind => {
    const observation = { source: 'DETERMINISTIC', checkId: 'no-https', pageUrl: 'https://example.com/', evidence: 'Recorded evidence' }
    const supporting = kind === 'native' ? { supportingObservations: observationsForFlag(observation,
      { auditId, taskId: 'original-security', checkVersion: 1, collectedAt: new Date().toISOString() }) } : {}
    await prisma.flag.create({ data: { ...observation, ...supporting, auditId, source: 'DETERMINISTIC', rubric: 'REACH', severity: 'IMPORTANT',
      problem: 'Recorded diagnosis', whyItMatters: 'Recorded impact', fix: 'Preserve the source and correct the observed failure.', confidence: 1, position: 0 } })
    await persistFlagDiffSummary(null, auditId)
    const home = await loadSiteHome(projectId, { ownerEvidence: true })
    expect(home?.flags).toHaveLength(1)
    expect(home?.flags[0].repairGuidance).toBe('ready')
    expect(home?.presentation.result.state).toBe('flags')
    expect((await loadSiteSummaries(userId))[0].presentation.result.state).toBe('flags')
    expect(await getOwnedRun(userId, runId)).toMatchObject({ result: 'FLAG', completionState: 'FULL' })
    expect(home?.monitoringHistory.find(entry => entry.id === auditId)).toMatchObject({ result: 'FLAG', flagCount: 1 })
  })

  it('keeps independent public checks conclusive when only an optional recommendation has unreadable evidence', async () => {
    await prisma.flag.create({ data: { auditId, source: 'DETERMINISTIC', rubric: 'REACH', severity: 'IMPORTANT', checkId: 'h1-generic',
      problem: 'Review the headline', evidence: 'Original wording', whyItMatters: 'Consider the page purpose', fix: 'Review the page purpose.',
      confidence: 1, position: 0, supportingObservations: { version: 99, items: [] } } })
    await persistFlagDiffSummary(null, auditId)
    expect((await loadSiteHome(projectId, { ownerEvidence: true }))?.presentation.result.state).toBe('clear')
    expect((await loadSiteSummaries(userId))[0].presentation.result.state).toBe('clear')
    expect(await getOwnedRun(userId, runId)).toMatchObject({ result: 'CLEAR' })
  })

  it.each(['SITE', 'CATEGORY'] as const)('preserves a published %s conclusion across a detector upgrade while current Site assurance requires reassessment', async scope => {
    await persistFlagDiffSummary(null, auditId)
    let observedId = auditId, requestId = runId
    if (scope === 'CATEGORY') {
      const source = await prisma.audit.findUniqueOrThrow({ where: { id: auditId }, include: { verifierExecutions: { where: { targetKey: 'module:security' } } } })
      const spec = executionSpecSchema.parse({ ...(source.executionSpec as object), scope,
        category: { area: 'security', sourceAuditId: auditId, pages: [source.url] } })
      const audit = await prisma.audit.create({ data: { projectId, userId, url: source.url, parentId: auditId,
        status: 'COMPLETED', completedAt: new Date(), executionSpec: spec,
        pages: { create: { url: source.url, normalizedUrl: source.url, status: 'COMPLETED', role: 'homepage', position: 0 } },
        verificationReceipts: { create: [{ targetKey: 'module:security', scopeKey: 'page:' + source.url,
          status: 'COMPLETED', source: 'DETERMINISTIC', detail: source.verifierExecutions[0].detail! }] },
        executionTasks: { create: initialTaskPlan(spec).map(task => ({ targetKey: 'task:' + task.key, scopeKey: task.scope, source: 'SYSTEM' as const,
          status: 'COMPLETED' as const, workState: 'COMPLETED' as const, workKind: task.kind, workDependencies: task.dependencies,
          workInput: task.input, pageUrl: task.input.pageUrl })) } } })
      observedId = audit.id
      const request = await prisma.runRequest.create({ data: { projectId, auditId: audit.id, source: 'WEB', idempotencyKey: randomUUID(),
        status: 'COMPLETED', completedAt: audit.completedAt, executionSpec: spec } })
      requestId = request.id
      await persistFlagDiffSummary(auditId, observedId)
    }
    expect((await loadSiteHome(projectId, { ownerEvidence: true }))?.monitoringHistory.find(entry => entry.id === observedId))
      .toMatchObject({ result: 'CLEAR', completionState: 'COMPLETED' })
    expect(await getOwnedRun(userId, requestId)).toMatchObject({ result: 'CLEAR', completionState: 'FULL' })
    const original = CHECK_REGISTRY['no-https']
    const before = await prisma.auditVerificationReceipt.findFirstOrThrow({ where: { auditId: observedId, targetKey: 'projection:flag-comparison' } })
    try {
      CHECK_REGISTRY['no-https'] = { ...original, version: original.version + 1 }
      const home = await loadSiteHome(projectId, { ownerEvidence: true })
      expect(home?.presentation.result.state).toBe('could_not_verify')
      expect((await loadSiteSummaries(userId))[0].presentation.result.state).toBe('could_not_verify')
      expect(home?.monitoringHistory.find(entry => entry.id === observedId)).toMatchObject({ result: 'CLEAR', completionState: 'COMPLETED' })
      expect(await getOwnedRun(userId, requestId)).toMatchObject({ result: 'CLEAR', completionState: 'FULL' })
      expect(await prisma.auditVerificationReceipt.findUniqueOrThrow({ where: { id: before.id } })).toEqual(before)
    } finally { CHECK_REGISTRY['no-https'] = original }
  })

  it('retains the original historical Flag membership and wording after the mutable source is corrected', async () => {
    const flag = await prisma.flag.create({ data: { auditId, source: 'DETERMINISTIC', rubric: 'REACH', severity: 'IMPORTANT',
      checkId: 'no-https', problem: 'Original diagnosis', evidence: 'Recorded source evidence', whyItMatters: 'Recorded impact',
      fix: 'Recorded repair guidance', confidence: 1, position: 0, pageUrl: 'https://example.com/' } })
    await persistFlagDiffSummary(null, auditId)
    const expected = { result: 'FLAG', flagCount: 1, flags: [{ id: flag.id, title: flag.problem }] }
    expect((await loadSiteHome(projectId, { ownerEvidence: true }))?.monitoringHistory.find(entry => entry.id === auditId)).toMatchObject(expected)
    await prisma.flag.update({ where: { id: flag.id }, data: { severity: 'POLISH', problem: 'Later corrected wording', status: 'FIXED' } })
    expect((await loadSiteHome(projectId, { ownerEvidence: true }))?.monitoringHistory.find(entry => entry.id === auditId)).toMatchObject(expected)
    expect(await getOwnedRun(userId, runId)).toMatchObject({ result: 'FLAG' })
  })

  it('expires broad Site evidence on daily care beside fresh uptime without rewriting its recorded conclusion', async () => {
    const checkedAt = new Date(Date.now() - 3 * 86400_000)
    await prisma.audit.update({ where: { id: auditId }, data: { createdAt: checkedAt, completedAt: checkedAt } })
    await persistFlagDiffSummary(null, auditId)
    const publication = await prisma.auditVerificationReceipt.findFirstOrThrow({ where: { auditId, targetKey: 'projection:flag-comparison' } })
    const recorded = await getOwnedRun(userId, runId)
    expect(recorded).toMatchObject({ result: 'CLEAR', validUntil: new Date(checkedAt.getTime() + 8 * 86400_000).toISOString() })
    expect(await setProjectWatch({ projectId, userId, interval: 'weekly' })).toMatchObject({ ok: true })
    await prisma.uptimeMonitor.upsert({ where: { projectId },
      create: { projectId, targetUrl: 'https://example.com/', state: 'online', lastCheckedAt: new Date() },
      update: { state: 'online', lastCheckedAt: new Date() } })
    expect((await loadSiteHome(projectId, { ownerEvidence: true }))?.presentation.result.state).toBe('clear')
    expect((await loadSiteSummaries(userId))[0].presentation.result.state).toBe('clear')

    expect(await setProjectWatch({ projectId, userId, interval: 'daily' })).toMatchObject({ ok: true })
    const home = (await loadSiteHome(projectId, { ownerEvidence: true }))!
    expect(home.presentation.result.state).toBe('stale')
    expect(home.cards.find(card => card.id === 'security')).toMatchObject({ state: 'unknown', checkedAt: checkedAt.toISOString() })
    expect(readSiteHomeView(JSON.parse(JSON.stringify(home)), projectId).presentation.result.state).toBe('stale')
    expect((await loadSiteSummaries(userId))[0].presentation.result.state).toBe('stale')
    expect(home.flags).toHaveLength(0)
    expect(home.monitoringHistory.find(entry => entry.id === auditId)?.result).toBe('CLEAR')
    expect(await getOwnedRun(userId, runId)).toEqual(recorded)
    expect(await prisma.auditVerificationReceipt.findUniqueOrThrow({ where: { id: publication.id } })).toEqual(publication)

    // A new controlled observation restores current assurance. The earlier
    // receipt stays untouched; this case exercises saved-state read paths.
    const original = await prisma.audit.findUniqueOrThrow({ where: { id: auditId }, include: { verifierExecutions: true } })
    const source = original.verifierExecutions.find(row => row.targetKey === 'module:security')!
    const refreshed = await prisma.audit.create({ data: { projectId, userId, url: original.url, status: 'COMPLETED',
      completedAt: new Date(), executionSpec: original.executionSpec!, evidenceCoverage: {}, reportCompleteness: 'FULL',
      pages: { create: { url: original.url, normalizedUrl: original.url, status: 'COMPLETED', role: 'homepage', position: 0 } },
      verificationReceipts: { create: { targetKey: source.targetKey, scopeKey: source.scopeKey, pageUrl: source.pageUrl,
        status: source.status, source: source.source, detail: source.detail! } } } })
    await prisma.runRequest.create({ data: { projectId, auditId: refreshed.id, requestedByUserId: userId, source: 'WATCH',
      idempotencyKey: randomUUID(), executionSpec: original.executionSpec!, status: 'COMPLETED', completedAt: refreshed.completedAt } })
    await persistFlagDiffSummary(null, refreshed.id)
    expect((await loadSiteHome(projectId, { ownerEvidence: true }))?.presentation.result.state).toBe('clear')
    expect((await loadSiteSummaries(userId))[0].presentation.result.state).toBe('clear')
    expect(await getOwnedRun(userId, runId)).toEqual(recorded)
    expect(await prisma.auditVerificationReceipt.findUniqueOrThrow({ where: { id: publication.id } })).toEqual(publication)
  })

  it('tightens current freshness after a cadence change while retaining historical assessment facts', async () => {
    const targetUrl = 'https://example.com/'
    const binding = { key: 'page-loads', mechanism: 'HTTP_AVAILABILITY' as const, required: true, version: 1,
      config: { startUrl: targetUrl, expectedSelector: 'body' }, scope: null }
    const outcome = await prisma.siteOutcome.create({ data: { projectId, name: 'Page loads', slug: 'page-loads',
      kind: 'AVAILABILITY', staleAfterMinutes: 8 * 24 * 60, bindings: { create: binding } } })
    const assessedAt = new Date(Date.now() - 2 * 86400_000), recordedUntil = new Date(assessedAt.getTime() + 8 * 86400_000)
    const spec = { version: 1, engine: 'progressive-v1', scope: 'OUTCOMES', targetUrl, environment: 'production', checks: {},
      verificationTarget: null, outcomes: [{ id: outcome.id, kind: outcome.kind, expectation: null, bindingPolicy: 'ALL_REQUIRED', bindings: [binding] }] }
    const observation = await prisma.audit.create({ data: { projectId, userId, url: targetUrl, status: 'COMPLETED',
      completedAt: assessedAt, createdAt: assessedAt, executionSpec: spec } })
    const request = await prisma.runRequest.create({ data: { projectId, auditId: observation.id, requestedByUserId: userId,
      source: 'WATCH', idempotencyKey: randomUUID(), status: 'COMPLETED', requestedAt: assessedAt, completedAt: assessedAt,
      executionSpec: spec, selections: { create: { outcomeId: outcome.id } } } })
    const assessment = await prisma.outcomeAssessment.create({ data: { outcomeId: outcome.id, runRequestId: request.id,
      auditId: observation.id, state: 'CLEAR', summary: 'The page responded successfully.', assessedAt, validUntil: recordedUntil,
      coverage: { environment: 'production', requiredBindings: [binding.key], observedBindings: [binding.key], bindings: [binding] },
      evidence: { reason: 'available' } } })
    await prisma.auditVerificationReceipt.create({ data: { auditId, targetKey: 'projection:flag-comparison', scopeKey: 'product', status: 'COMPLETED',
      source: 'SYSTEM', detail: { kind: 'flag-comparison', version: 1, auditId, parentAuditId: null,
        summary: { fixed: [], inconclusive: [], unchanged: [], regressed: [], newIssues: [] } } } })
    expect(await setProjectWatch({ projectId, userId, interval: 'weekly' })).toMatchObject({ ok: true })
    // This fixture varies Outcome freshness. Current Site assurance also needs
    // an independent recent reachability observation after monitoring starts.
    await prisma.uptimeMonitor.upsert({ where: { projectId }, create: { projectId, targetUrl, state: 'online', lastCheckedAt: new Date() },
      update: { state: 'online', lastCheckedAt: new Date() } })
    await prisma.project.update({ where: { id: projectId }, data: { notificationLevel: 'FLAGS' } })
    const preference = await prisma.notificationPreference.create({ data: { userId, cadence: 'DAILY' } })
    const owner = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } })
    const summary = () => buildSummaryPayload({ id: 'freshness-summary', userId, revision: preference.revision,
      scheduledAt: new Date(), user: owner, preference }, new Date(), () => new Date())
    expect((await loadSiteHome(projectId, { ownerEvidence: true }))?.presentation.result.state).toBe('clear')
    expect((await loadSiteSummaries(userId))[0].presentation.result.state).toBe('clear')
    expect((await summary())?.text).toContain(NOTIFICATIONS_COPY.summary.quiet)

    expect(await setProjectWatch({ projectId, userId, interval: 'hourly' })).toMatchObject({ ok: true })
    const currentUntil = new Date(assessedAt.getTime() + 13 * 3600_000).toISOString()
    const home = await loadSiteHome(projectId, { ownerEvidence: true })
    expect(home?.outcomes.find(item => item.id === outcome.id)).toMatchObject({ state: 'STALE', validUntil: currentUntil })
    expect(home?.presentation.result.state).toBe('stale')
    expect(home?.presentation.freshness.stale).toBe(true)
    expect((await loadSiteSummaries(userId))[0].presentation.result.state).toBe('stale')
    const staleSummary = await summary()
    expect(staleSummary?.text).toContain(NOTIFICATIONS_COPY.summary.stale)
    expect(staleSummary?.text).not.toContain(NOTIFICATIONS_COPY.summary.quiet)
    const site = await loadSiteRecord(projectId)
    expect(await loadSiteOutcomeDetail(site!, outcome.id)).toMatchObject({ state: 'STALE', validUntil: currentUntil })
    expect(await getOwnedRun(userId, request.id)).toMatchObject({ result: 'CLEAR', validUntil: recordedUntil.toISOString() })
    expect(await prisma.outcomeAssessment.findUniqueOrThrow({ where: { id: assessment.id } })).toEqual(assessment)
    expect(await prisma.flag.count({ where: { auditId: observation.id } })).toBe(0)

    const refreshedAt = new Date(), refreshedUntil = new Date(refreshedAt.getTime() + 13 * 3600_000)
    const refreshedAudit = await prisma.audit.create({ data: { projectId, userId, url: targetUrl, status: 'COMPLETED',
      completedAt: refreshedAt, executionSpec: spec } })
    const refreshedRun = await prisma.runRequest.create({ data: { projectId, auditId: refreshedAudit.id, source: 'WATCH',
      idempotencyKey: randomUUID(), status: 'COMPLETED', executionSpec: spec, completedAt: refreshedAt,
      selections: { create: { outcomeId: outcome.id } } } })
    await prisma.outcomeAssessment.create({ data: { ...assessment, id: undefined, auditId: refreshedAudit.id,
      runRequestId: refreshedRun.id, assessedAt: refreshedAt, validUntil: refreshedUntil } })
    expect((await loadSiteHome(projectId, { ownerEvidence: true }))?.outcomes.find(item => item.id === outcome.id))
      .toMatchObject({ state: 'CLEAR', validUntil: refreshedUntil.toISOString() })
    expect((await loadSiteSummaries(userId))[0].presentation.result.state).toBe('clear')
    expect((await summary())?.text).not.toContain(NOTIFICATIONS_COPY.summary.stale)
    expect((await loadSiteSummaries(userId))[0].presentation.freshness.stale).toBe(false)

    const changedAt = new Date()
    expect(await setProjectWatch({ projectId, userId, interval: 'weekly' }, { clock: fixedClock(changedAt) })).toMatchObject({ ok: true })
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({ watchNextRunAt: changedAt })
    expect((await loadSiteHome(projectId, { ownerEvidence: true }))?.outcomes.find(item => item.id === outcome.id))
      .toMatchObject({ state: 'CLEAR', validUntil: refreshedUntil.toISOString() })
    expect(await prisma.outcomeAssessment.findUniqueOrThrow({ where: { id: assessment.id } })).toEqual(assessment)
  })
})
