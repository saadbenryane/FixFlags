import { randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as accountSettings from '@/lib/sites/accounts/store'
import * as connectionViews from '@/lib/sites/connections/read'
import { prisma } from '@/lib/db'
import { loadSiteHome } from '../queries'
import { loadSiteCheckResultPage } from '../check-results'
import { loadCategoryEvidence } from '../category-evidence'
import { projectCurrentSiteEvidence } from '../current-evidence'
import { loadSiteSummaries } from '../list-sites'
import { getOwnedRun } from '../run-queries'
import { loadMonitoringHistory } from '../monitoring-history'
import { setProjectWatch } from '../monitoring-settings'
import { loadSiteOutcomeDetail } from '../outcome-queries'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { fixedClock } from '@/lib/time/clock'
import { CHECK_REGISTRY } from '@/lib/audit/check-registry'
import { persistFlagDiffSummary } from '@/lib/audit/diff-flags'
import { initialTaskPlan } from '@/lib/audit/progressive/graph'
import { executionSpecSchema } from '@/lib/sites/domain/execution-spec'
import { DEFAULT_AVAILABILITY_EVALUATOR } from '@/lib/sites/domain/outcome-evaluation'
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
import { recordCheckObservations } from '@/lib/audit/checks/observations'
import { scopePerformanceAssertions } from '@/lib/audit/performance-measurement'
import { runTrackingChecks } from '@/lib/audit/checks/tracking'
import { primaryActionAssertions, primaryActionResponseDestinationKey, primaryControlContext, primaryPageContext } from '@/lib/audit/flow/primary-action-evidence'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'

function securityObservation(auditId: string, pageUrl: string, collectedAt: Date, taskId = auditId + '-security') {
  return { kind: 'site-module-check', version: 1, module: 'security', pageUrl, applicable: true, passed: true, complete: true,
    assertions: ['https', 'image-transport'].map(key => ({ key, name: key, expected: 'Safe', observed: 'Observed', passed: true, complete: true })),
    execution: { auditId, taskId, checkVersion: 1, source: 'http', collectedAt: collectedAt.toISOString() } }
}

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
    auditId = randomUUID()
    const completedAt = new Date()
    await prisma.audit.create({ data: { id: auditId, projectId, userId, url: project.url, status: 'COMPLETED',
      completedAt, reportCompleteness: 'FULL', executionSpec, evidenceCoverage: {},
      pages: { create: { url: project.url, normalizedUrl: project.url, status: 'COMPLETED', role: 'homepage', position: 0 } },
      verificationReceipts: { create: { targetKey: 'module:security', scopeKey: 'page:' + project.url,
        pageUrl: project.url, source: 'DETERMINISTIC', status: 'COMPLETED', detail: securityObservation(auditId, project.url, completedAt) } } } })
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

  it.each([1, 2] as const)('shows Security health only after its page scope settles at review depth %s', async reviewDepth => {
    const url = 'https://example.com/', linkedUrl = url + 'about', now = new Date()
    const spec = executionSpecSchema.parse({ version: 1, engine: 'progressive-v1', scope: 'SITE', environment: 'production',
      targetUrl: url, reviewDepth, ...(reviewDepth === 2 ? { monitoringPages: [url, linkedUrl] } : {}),
      checks: { 'no-https': 1, 'security-mixed-content': 1 },
      outcomes: [], verificationTarget: null })
    const currentId = randomUUID()
    await prisma.audit.create({ data: { id: currentId, projectId, userId, url, status: 'CHECKING',
      createdAt: new Date(now.getTime() + 1), startedAt: now, executionSpec: spec,
      executionTasks: { create: initialTaskPlan(spec).map(task => ({ targetKey: 'task:' + task.key, scopeKey: task.scope,
        source: 'SYSTEM', status: 'PENDING', workState: 'WAITING', workKind: task.kind, workDependencies: task.dependencies,
        workInput: task.input, pageUrl: task.input.pageUrl })) } } })
    const publishSecurity = (pageUrl: string, taskKey: string) => prisma.$transaction(async tx => {
      const task = await tx.auditExecutionTask.findFirstOrThrow({ where: { auditId: currentId, targetKey: taskKey } })
      await tx.auditVerificationReceipt.create({ data: { auditId: currentId, taskId: task.id, targetKey: 'module:security',
        scopeKey: 'page:' + pageUrl, pageUrl, source: 'DETERMINISTIC', status: 'COMPLETED',
        detail: securityObservation(currentId, pageUrl, now, task.id) } })
      await tx.auditExecutionTask.update({ where: { id: task.id }, data: { status: 'COMPLETED', workState: 'COMPLETED' } })
    })
    const card = async () => (await loadSiteHome(projectId, { ownerEvidence: true }))!.cards.find(card => card.id === 'security')
    // A new first check has no last-known health to show during discovery.
    await prisma.audit.update({ where: { id: auditId }, data: { status: 'FAILED' } })
    await publishSecurity(url, 'task:p0:security')
    if (reviewDepth === 2) {
      expect(await card()).toMatchObject({ state: 'unknown', evidenced: false, activity: 'checking' })
      await prisma.auditExecutionTask.updateMany({ where: { auditId: currentId, workKind: 'discovery' },
        data: { status: 'COMPLETED', workState: 'COMPLETED' } })
      expect(await card()).toMatchObject({ state: 'unknown', evidenced: false, activity: 'checking' })
      await publishSecurity(linkedUrl, 'task:p1:security')
    }
    expect(await card()).toMatchObject({ state: 'healthy', evidenced: true, checkedAt: now.toISOString() })
    expect(await prisma.auditExecutionTask.count({ where: { auditId: currentId, workKind: 'search', status: 'PENDING' } })).toBeGreaterThan(0)
  })

  it.each(['missing payload', 'partial legacy receipt'] as const)('keeps %s unknown across Security checks and current Site evidence', async mode => {
    const audit = await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })
    const header = await prisma.auditVerificationReceipt.create({ data: { auditId, targetKey: 'module:security-headers',
      scopeKey: 'page:' + audit.url, pageUrl: audit.url, source: 'DETERMINISTIC', status: 'COMPLETED',
      detail: mode === 'missing payload' ? {} : { passed: true, complete: false,
        assertions: [{ key: 'content-security-policy', name: 'Content Security Policy', expected: 'Policy declared', observed: 'Policy declared', passed: true }] } } })
    await persistFlagDiffSummary(null, auditId)
    const home = (await loadSiteHome(projectId, { ownerEvidence: true }))!
    expect(home.cards.find(card => card.id === 'security')).toMatchObject({ state: 'unknown', incompleteReason: expect.any(String) })
    expect(await getOwnedRun(userId, runId)).toMatchObject({ result: 'COULD_NOT_VERIFY' })
    expect((await loadSiteSummaries(userId))[0].presentation.result).toEqual(home.presentation.result)
    expect((await loadSiteNotificationSummaries(userId, new Date()))[0].notification.incomplete).toBe(true)
    const history = await loadSiteCheckResultPage(home.site, audit, undefined, undefined, { area: 'security' }, true)
    const shown = history.results.filter(item => item.evidenceReference.executionId === header.id)
    expect(shown.map(item => item.status)).toEqual(mode === 'missing payload' ? ['unknown'] : ['passed', 'unknown'])
    expect(await prisma.auditVerificationReceipt.findUniqueOrThrow({ where: { id: header.id } })).toEqual(header)
  })

  it.each([false, true])('does not use another task’s Security evidence (valid peer: %s)', async validPeer => {
    const audit = await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })
    const tasks = await Promise.all(['linked', 'other'].map(key => prisma.auditExecutionTask.create({ data: {
      auditId, targetKey: 'task:' + key, pageUrl: audit.url, source: 'SYSTEM', status: 'COMPLETED', workKind: 'check',
    } })))
    const original = await prisma.auditVerificationReceipt.findFirstOrThrow({ where: { auditId, targetKey: 'module:security' } })
    const { execution, ...detail } = securityObservation(auditId, audit.url, audit.completedAt!, tasks[1].id)
    const data = { taskId: tasks[0].id, detail: validPeer ? { ...detail, execution, complete: false } : { ...detail, execution } }
    const mismatched = validPeer ? await prisma.auditVerificationReceipt.create({ data: {
      auditId, targetKey: original.targetKey, pageUrl: audit.url, source: original.source, status: 'COMPLETED',
      scopeKey: 'mismatched-task', ...data,
    } }) : await prisma.auditVerificationReceipt.update({ where: { id: original.id }, data })
    await persistFlagDiffSummary(null, auditId)
    const home = (await loadSiteHome(projectId, { ownerEvidence: true }))!
    expect(home.cards.find(card => card.id === 'security')).toMatchObject({
      state: validPeer ? 'healthy' : 'unknown', incompleteReason: validPeer ? null : expect.any(String),
    })
    expect(await getOwnedRun(userId, runId)).toMatchObject({ result: validPeer ? 'CLEAR' : 'COULD_NOT_VERIFY' })
    expect((await loadSiteSummaries(userId))[0].presentation.result).toEqual(home.presentation.result)
    expect((await loadSiteNotificationSummaries(userId, new Date()))[0].notification.incomplete).toBe(!validPeer)
    const history = await loadSiteCheckResultPage(home.site, audit, undefined, undefined, { area: 'security' }, true)
    expect(history.total).toBe(validPeer ? 4 : 1)
    expect(history.results.filter(item => item.evidenceReference.executionId === mismatched.id)).toMatchObject([
      { kind: 'execution', status: 'unknown', limitation: 'Recorded evidence could not be linked to this check.' },
    ])
    expect(await prisma.auditVerificationReceipt.findUniqueOrThrow({ where: { id: mismatched.id } })).toEqual(mismatched)
  })

  it('does not call an unreadable terminal Security receipt checked while the Run continues', async () => {
    const audit = await prisma.audit.update({ where: { id: auditId }, data: { status: 'CHECKING', startedAt: new Date(), completedAt: null } })
    await prisma.auditVerificationReceipt.updateMany({ where: { auditId, targetKey: 'module:security' }, data: { detail: {} } })
    const entry = { pageUrl: audit.url, position: 0, primary: true, role: 'homepage' }
    await prisma.auditExecutionTask.createMany({ data: [
      { auditId, pageUrl: audit.url, targetKey: 'task:discovery', scopeKey: 'discovery', source: 'SYSTEM',
        status: 'COMPLETED', workState: 'COMPLETED', workKind: 'discovery', workInput: entry },
      { auditId, pageUrl: audit.url, targetKey: 'task:p0:metadata', scopeKey: 'page:' + audit.url, source: 'SYSTEM',
        status: 'PENDING', workState: 'WAITING', workKind: 'check', workInput: { ...entry, module: 'metadata' } },
    ] })
    const home = (await loadSiteHome(projectId, { ownerEvidence: true }))!
    expect(home.cards.find(card => card.id === 'security')).toMatchObject({ state: 'unknown',
      status: SITE_ACTION_COPY.execution.partialStatus, incompleteReason: SITE_BOARD_COPY.cardCheckIncomplete })
  })

  it.each(['missing', 'split', 'foreign', 'complete'] as const)('projects %s linked Security evidence from the same recorded page scope', async linked => {
    const url = 'https://example.com/', peer = url + 'about', checkedAt = new Date()
    const primary = await prisma.auditVerificationReceipt.findFirstOrThrow({ where: { auditId, targetKey: 'module:security' } })
    const detail = securityObservation(auditId, url, checkedAt)
    await prisma.auditVerificationReceipt.update({ where: { id: primary.id }, data: {
      detail: linked === 'split' ? { ...detail, assertions: detail.assertions.filter(assertion => assertion.key === 'https') } : detail,
    } })
    await prisma.auditPage.create({ data: { auditId, url: peer, normalizedUrl: peer, status: 'COMPLETED', role: 'internal', position: 1 } })
    if (linked !== 'missing') {
      const linkedDetail = securityObservation(linked === 'foreign' ? randomUUID() : auditId, peer, checkedAt)
      await prisma.auditVerificationReceipt.create({ data: { auditId, targetKey: 'module:security', scopeKey: 'page:' + peer,
        pageUrl: peer, status: 'COMPLETED', source: 'DETERMINISTIC',
        detail: linked === 'split' ? { ...linkedDetail, assertions: linkedDetail.assertions.filter(assertion => assertion.key === 'image-transport') } : linkedDetail } })
    }
    await persistFlagDiffSummary(null, auditId)
    const home = (await loadSiteHome(projectId, { ownerEvidence: true }))!
    const complete = linked === 'complete'
    expect(home.cards.find(card => card.id === 'security')).toMatchObject({
      state: complete ? 'healthy' : 'unknown', incompleteReason: complete ? null : expect.any(String),
    })
    expect((await loadSiteSummaries(userId))[0].presentation.result).toEqual(home.presentation.result)
    expect(await getOwnedRun(userId, runId)).toMatchObject({ result: complete ? 'CLEAR' : 'COULD_NOT_VERIFY' })
  })

  it.each(['missing automated', 'missing keyboard', 'foreign keyboard', 'complete'] as const)('projects %s linked-page Accessibility evidence against the admitted methods', async linked => {
    const pageUrl = 'https://example.com/', peer = pageUrl + 'about', collectedAt = new Date().toISOString()
    const current = await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })
    const executionSpec = { ...(current.executionSpec as Prisma.JsonObject),
      checks: { 'buttons-no-text': CHECK_REGISTRY['buttons-no-text'].version, 'focus-visible-missing': CHECK_REGISTRY['focus-visible-missing'].version } }
    await prisma.$transaction([
      prisma.audit.update({ where: { id: auditId }, data: { executionSpec } }),
      prisma.runRequest.update({ where: { id: runId }, data: { executionSpec } }),
      prisma.auditPage.create({ data: { auditId, url: peer, normalizedUrl: peer, status: 'COMPLETED', role: 'internal', position: 1 } }),
    ])
    for (const url of [pageUrl, peer]) {
      for (const checkModule of ['accessibility', 'keyboard'] as const) {
        if (url === peer && (linked === 'missing automated' && checkModule === 'accessibility' || linked === 'missing keyboard' && checkModule === 'keyboard')) continue
        const keys = checkModule === 'accessibility' ? ['automated-accessibility'] : ['focus-styles', 'keyboard-exit', 'tab-sequence']
        await prisma.auditVerificationReceipt.create({ data: { auditId, targetKey: 'module:' + checkModule, scopeKey: 'page:' + url,
          pageUrl: url, status: 'COMPLETED', source: 'DETERMINISTIC', detail: {
            kind: 'site-module-check', version: 1, module: checkModule, pageUrl: url, complete: true, applicable: true, passed: true,
            assertions: keys.map(key => ({ key, name: key, expected: 'Observed', observed: 'Recorded fixture result', passed: true, complete: true })),
            execution: { auditId: url === peer && checkModule === 'keyboard' && linked === 'foreign keyboard' ? randomUUID() : auditId,
              taskId: checkModule + ':' + url, checkVersion: 1, source: checkModule === 'keyboard' ? 'keyboard' : 'browser-accessibility', collectedAt },
          } } })
      }
    }
    await persistFlagDiffSummary(null, auditId)
    const home = (await loadSiteHome(projectId, { ownerEvidence: true }))!
    const complete = linked === 'complete'
    expect(home.cards.find(card => card.id === 'accessibility')).toMatchObject({
      state: complete ? 'healthy' : 'unknown', incompleteReason: complete ? null : expect.any(String),
    })
    expect((await loadSiteSummaries(userId))[0].presentation.result).toEqual(home.presentation.result)
    expect(await getOwnedRun(userId, runId)).toMatchObject({ result: complete ? 'CLEAR' : 'COULD_NOT_VERIFY' })
  })

  it.each(['QUEUED', 'CHECKING', 'FAILED'] as const)('retains fresh category assurance while the next full-site check is %s', async status => {
    const now = Date.now(), url = 'https://example.com/'
    const baseline = await prisma.audit.update({ where: { id: auditId }, data: {
      createdAt: new Date(now - 10 * 86400_000), completedAt: new Date(now - 9 * 86400_000),
    }, include: { verifierExecutions: { where: { targetKey: 'module:security' } } } })
    const broadReceipt = baseline.verifierExecutions[0]
    await prisma.auditVerificationReceipt.update({ where: { id: broadReceipt.id },
      data: { detail: securityObservation(auditId, url, baseline.completedAt!) } })
    await persistFlagDiffSummary(null, auditId)
    const spec = executionSpecSchema.parse({ ...(baseline.executionSpec as object), scope: 'CATEGORY',
      category: { area: 'security', sourceAuditId: auditId, pages: [url] } })
    // Persisted observations isolate reader provenance. They are not fresh
    // webpage collection or provider evidence.
    const categoryId = randomUUID()
    const category = await prisma.audit.create({ data: { id: categoryId, projectId, userId, url, parentId: auditId,
      status: 'COMPLETED', createdAt: new Date(now - 2000), completedAt: new Date(now - 1000), executionSpec: spec,
      pages: { create: { url, normalizedUrl: url, status: 'COMPLETED', role: 'homepage', position: 0 } },
      verificationReceipts: { create: { targetKey: 'module:security', scopeKey: 'page:' + url,
        status: 'COMPLETED', source: 'DETERMINISTIC',
        detail: securityObservation(categoryId, url, new Date(now - 1000)), updatedAt: new Date(now - 1000) } },
      executionTasks: { create: initialTaskPlan(spec).map(task => ({ targetKey: 'task:' + task.key, scopeKey: task.scope, source: 'SYSTEM' as const,
        status: 'COMPLETED' as const, workState: 'COMPLETED' as const, workKind: task.kind, workDependencies: task.dependencies,
        workInput: task.input, pageUrl: task.input.pageUrl })) } } })
    await persistFlagDiffSummary(auditId, category.id)
    const before = (await loadSiteHome(projectId, { ownerEvidence: true }))!
    expect(before.cards.find(card => card.id === 'security')).toMatchObject({ state: 'healthy', evidenced: true,
      checkedAt: category.completedAt!.toISOString() })
    const current = await prisma.audit.create({ data: { projectId, userId, url, status, createdAt: new Date(now),
      completedAt: status === 'FAILED' ? new Date(now) : null, executionSpec: baseline.executionSpec!, evidenceCoverage: {} } })
    if (status === 'FAILED') {
      await prisma.auditVerificationReceipt.create({ data: { auditId: current.id, targetKey: 'module:security',
        scopeKey: 'page:' + url, pageUrl: url, status: 'COMPLETED', source: 'DETERMINISTIC',
        detail: securityObservation(current.id, url, new Date(now)) } })
    }
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

  it.each(['pending', 'unavailable'] as const)('retains the source repair recipe while its prescription is %s', async state => {
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
    const prepared = home.flags.find(item => item.sourceFlagId === flag.id)
    expect(prepared).toMatchObject({ repairGuidance: 'ready' })
    expect(await loadSiteFlagDetail(home.site, flag.id)).toMatchObject({ sourceAuditId: source.id, repairGuidance: 'ready', fix: prepared?.fix,
      repairDefinition: { source: 'check-recipe', checkId: flag.checkId } })
    expect(readSiteHomeView(JSON.parse(JSON.stringify(home)), projectId).flags.find(item => item.sourceFlagId === flag.id)?.fix)
      .toEqual(prepared?.fix)
    expect((await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).fix).toBe('')
    let newerFlagId: string | null = null
    if (state === 'pending') {
      const newer = await prisma.flag.create({ data: { auditId, source: 'DETERMINISTIC', checkId: flag.checkId,
        fingerprint: flag.fingerprint, rubric: 'EXPERIENCE', severity: 'IMPORTANT', confidence: 1, position: 0,
        problem: 'The current button needs a label', evidence: 'A newer recorded occurrence', whyItMatters: flag.whyItMatters,
        fix: 'Guidance for the newer occurrence.', pageUrl: latest.url } })
      newerFlagId = newer.id
      expect((await loadSiteHome(projectId, { ownerEvidence: true }))!.flags.some(item => item.sourceFlagId === flag.id)).toBe(false)
      expect(await loadSiteFlagDetail(home.site, flag.id)).toMatchObject({ sourceAuditId: source.id, repairGuidance: 'ready', fix: prepared?.fix })
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

  it('withholds a saved Clear across Site views when the comparison parent belongs to another Site', async () => {
    const parent = await prisma.audit.create({ data: { projectId, userId, url: 'https://example.com/',
      status: 'COMPLETED', completedAt: new Date(Date.now() - 60_000), createdAt: new Date(Date.now() - 60_000) } })
    await prisma.audit.update({ where: { id: auditId }, data: { parentId: parent.id } })
    await persistFlagDiffSummary(parent.id, auditId)
    const receipt = await prisma.auditVerificationReceipt.findFirstOrThrow({ where: { auditId, targetKey: 'projection:flag-comparison' } })

    async function expectState(result: 'CLEAR' | 'COULD_NOT_VERIFY', state: 'clear' | 'could_not_verify') {
      expect(await getOwnedRun(userId, runId)).toMatchObject({ result })
      const home = await loadSiteHome(projectId, { ownerEvidence: true })
      expect(home?.presentation.result.state).toBe(state)
      expect(home?.monitoringHistory.find(entry => entry.id === auditId)).toMatchObject({ result,
        completionState: result === 'CLEAR' ? 'COMPLETED' : 'PARTIAL' })
      expect((await loadSiteSummaries(userId)).find(site => site.id === projectId)?.presentation.result.state).toBe(state)
    }

    await expectState('CLEAR', 'clear')
    const foreign = await prisma.project.create({ data: { userId, name: 'Separate Site',
      canonicalHost: 'other.example.com', url: 'https://other.example.com/' } })
    await prisma.audit.update({ where: { id: parent.id }, data: { projectId: foreign.id } })
    await expectState('COULD_NOT_VERIFY', 'could_not_verify')
    await prisma.audit.update({ where: { id: parent.id }, data: { projectId: null, userId: null } })
    try {
      await expectState('CLEAR', 'clear')
      expect(await prisma.auditVerificationReceipt.findUniqueOrThrow({ where: { id: receipt.id } })).toEqual(receipt)
    } finally { await prisma.audit.delete({ where: { id: parent.id } }) }
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

  it.each(['unavailable', 'missing', 'empty', 'empty module', 'wrong evaluator', 'complete', 'another run', 'outside scope', 'mismatched ledger page',
    'foreign failure', 'admitted failure'] as const)('reads %s linked-page Search evidence consistently across current Site, saved run and notification views', async linked => {
    const now = new Date(), root = 'https://example.com/', about = root + 'about'
    const html = '<html lang="en"><head><title>Recorded title</title></head><body><h1>Recorded page</h1></body></html>'
    const readLanguage = async (url: string, available: boolean) => {
      const source = document(available ? html : null, { url, finalUrl: url, collectedAt: now.toISOString(),
        complete: available, reason: available ? null : 'document_truncated' })
      const observations = (await evaluateSearch(evidence(html, { auditId, pageUrl: url, collectorVersion: 2,
        collectedAt: now.toISOString(), original: source, rendered: source }), null, ['presentation']))
        .filter(item => item.checkId === 'search-page-language')
      expect(observations.length).toBeGreaterThan(0)
      expect(observations.every(item => item.disposition === (available ? 'observed' : 'unknown'))).toBe(true)
      return { kind: 'search-checks', version: 1, auditId, pageUrl: url, collectedAt: now.toISOString(),
        complete: available, observations }
    }
    const baseline = await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })
    const executionSpec = { ...(baseline.executionSpec as Prisma.JsonObject), checks: { 'search-page-language': CHECK_REGISTRY['search-page-language'].version } }
    await prisma.$transaction([
      prisma.audit.update({ where: { id: auditId }, data: { executionSpec } }),
      prisma.runRequest.update({ where: { id: runId }, data: { executionSpec } }),
    ])
    await prisma.auditPage.create({ data: { auditId, url: about, normalizedUrl: about, status: 'COMPLETED', role: 'internal', position: 1 } })
    // These are actual parser observations on supplied documents. The fixture
    // exercises persisted projection, not HTTP or browser collection.
    for (const url of linked === 'missing' ? [root] : [root, about]) {
      const detail = await readLanguage(url, url === root || linked !== 'unavailable')
      await prisma.auditVerificationReceipt.create({ data: { auditId, targetKey: 'module:search', scopeKey: 'page:' + url,
        pageUrl: url, source: 'DETERMINISTIC', status: 'COMPLETED',
        detail: (url === about && linked === 'empty' ? { ...detail, observations: [] } : detail) as Prisma.InputJsonValue } })
    }
    if (['another run', 'outside scope', 'mismatched ledger page', 'foreign failure', 'admitted failure'].includes(linked)) {
      const observed = linked === 'outside scope' ? root + 'outside' : about
      const detail = await readLanguage(observed, false)
      const failed = linked === 'foreign failure' || linked === 'admitted failure'
      await prisma.auditVerificationReceipt.create({ data: { auditId, targetKey: 'module:search-presentation', scopeKey: 'retained-search',
        pageUrl: linked === 'mismatched ledger page' ? root : observed, source: 'SEARCH', status: failed ? 'FAILED' : 'COMPLETED',
        detail: { ...detail, auditId: linked === 'another run' || linked === 'foreign failure' ? randomUUID() : auditId } as Prisma.InputJsonValue } })
    }
    if (linked === 'empty module' || linked === 'wrong evaluator') await prisma.auditVerificationReceipt.create({ data: { auditId,
      targetKey: 'module:search-canonical', scopeKey: 'page:' + about, pageUrl: about, source: 'SEARCH', status: 'COMPLETED',
      detail: linked === 'wrong evaluator' ? (await readLanguage(about, true)) as Prisma.InputJsonValue
        : { kind: 'search-checks', version: 1, auditId, pageUrl: about, collectedAt: now.toISOString(), complete: true, observations: [] } } })
    await persistFlagDiffSummary(null, auditId)
    const before = await prisma.auditVerificationReceipt.findMany({ where: { auditId }, orderBy: { id: 'asc' } })
    const home = (await loadSiteHome(projectId, { ownerEvidence: true }))!
    const list = (await loadSiteSummaries(userId))[0]
    const notification = (await loadSiteNotificationSummaries(userId, now))[0]
    const complete = ['complete', 'another run', 'outside scope', 'mismatched ledger page', 'foreign failure'].includes(linked)
    const state = complete ? 'healthy' : 'unknown'
    expect(home.cards.find(card => card.id === 'search')).toMatchObject({ state, incompleteReason: complete ? null : expect.any(String) })
    expect(home.presentation.categories.find(category => category.id === 'search')).toMatchObject({ state })
    expect(home.presentation.result.state).toBe(complete ? 'clear' : 'could_not_verify')
    expect(await getOwnedRun(userId, runId)).toMatchObject({ result: complete ? 'CLEAR' : 'COULD_NOT_VERIFY' })
    expect(list.presentation.result).toEqual(home.presentation.result)
    expect(notification.notification.incomplete).toBe(!complete)
    expect(readSiteHomeView(JSON.parse(JSON.stringify(home)), projectId).cards.find(card => card.id === 'search')?.state).toBe(state)
    if (linked === 'empty' || linked === 'empty module' || linked === 'wrong evaluator') {
      const checks = await loadSiteCheckResultPage(home.site, baseline, undefined, undefined, { area: 'search', pageUrl: about }, true)
      expect(checks.results).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'execution', status: 'unknown', pageUrl: about })]))
      if (linked !== 'empty') expect(checks.results).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'assertion', status: 'observed', pageUrl: about })]))
      if (linked === 'wrong evaluator') {
        const misplaced = before.find(row => row.targetKey === 'module:search-canonical')!
        expect(checks.results.filter(row => row.evidenceReference.executionId === misplaced.id))
          .toMatchObject([{ kind: 'execution', status: 'unknown' }])
      }
      expect(checks.total).toBe(checks.results.length)
    }
    expect(await prisma.auditVerificationReceipt.findMany({ where: { auditId }, orderBy: { id: 'asc' } })).toEqual(before)
  })

  it.each(['verified', 'missing entry', 'other run', 'pricing only', 'click only', 'optional entry',
    'different control', 'missing retained control', 'verified retained controls', 'same-page step'] as const)(
    'qualifies a Conversion journey from its admitted action receipts (%s)', async mode => {
      const root = 'https://example.com/', entry = root + 'help'
      const audit = await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })
      const pageContextFor = (url: string) => primaryPageContext(url, url, { width: 1280, height: 800 })
      const controlFor = (url: string, identity = 'primary') => primaryControlContext({ pageContext: pageContextFor(url),
        identity, label: 'Get started', href: '/start', controls: null })
      const retained = mode === 'missing retained control' || mode === 'verified retained controls'
      const executionSpec = { ...(audit.executionSpec as Prisma.JsonObject), checks: { 'flow-cta-dead-end': CHECK_REGISTRY['flow-cta-dead-end'].version },
        monitoringPages: [root, entry], monitoringEntryPages: [root, entry], ...(retained ? {
          monitoringBehaviors: [{ pageUrl: entry, behaviors: ['flow'], actionContexts: [controlFor(entry), controlFor(entry, 'second')] }],
        } : {}) }
      await prisma.$transaction([
        prisma.audit.update({ where: { id: auditId }, data: { executionSpec, evidenceCoverage: { flowScan: true } } }),
        prisma.runRequest.update({ where: { id: runId }, data: { executionSpec } }),
        prisma.auditPage.create({ data: { auditId, url: entry, normalizedUrl: entry, status: 'COMPLETED', role: 'internal', position: 1 } }),
      ])
      const observations = [{ pageUrl: root, identity: 'primary' }]
      if (mode !== 'missing entry') observations.push({ pageUrl: entry, identity: 'primary' })
      if (mode === 'verified retained controls') observations.push({ pageUrl: entry, identity: 'second' })
      for (const { pageUrl, identity } of observations) {
        const optional = mode === 'optional entry' && pageUrl === entry
        const panel = mode === 'same-page step' && pageUrl === entry
        const pageContext = pageContextFor(pageUrl), controlContext = controlFor(pageUrl, identity)
        const assertions = primaryActionAssertions({ version: 1, pageContext, controlContext: optional ? null : controlContext,
          candidateCount: optional ? 0 : 1, candidateComplete: true, clicked: !optional, clickBlocked: false,
          navigation: optional ? 'unknown' : 'changed', ...(panel ? { samePageProgress: 'declared-panel' } : {}),
          response: optional || panel ? 'unknown' : 'healthy', responseExpected: !optional && !panel,
          httpStatus: optional || panel ? null : 200, responseDestinationKey: optional || panel ? null : primaryActionResponseDestinationKey(root + 'start'),
          destinationContentObserved: !optional }, !optional)
        if (mode === 'different control' && pageUrl === entry) {
          assertions.find(assertion => assertion.key === 'primary-action-response')!.context = controlFor(entry, 'another')
        }
        const pricingOnly = mode === 'pricing only' && pageUrl === entry
        await prisma.auditVerificationReceipt.create({ data: { auditId, targetKey: 'module:flow',
          scopeKey: 'page:' + pageUrl + (pricingOnly ? ':pricing-navigation' : ':control:' + controlContext),
          pageUrl, source: 'DETERMINISTIC', status: 'COMPLETED', detail: {
            kind: 'site-module-check', version: 1, module: 'flow', pageUrl, applicable: !optional, complete: true, passed: !optional,
            assertions: pricingOnly ? [{ key: 'pricing-navigation', name: 'Pricing link', expected: 'Pricing reached', observed: 'Pricing reached', passed: true, complete: true }]
              : mode === 'click only' && pageUrl === entry ? assertions.filter(assertion => assertion.key === 'primary-action-click') : assertions,
            execution: { auditId: mode === 'other run' && pageUrl === entry ? 'other-audit' : auditId, taskId: 'flow-' + pageUrl,
              checkVersion: 1, source: 'rendered-dom', collectedAt: audit.completedAt!.toISOString() },
          } } })
      }
      await persistFlagDiffSummary(null, auditId)
      const before = await prisma.auditVerificationReceipt.findMany({ where: { auditId }, orderBy: { id: 'asc' } })
      const home = (await loadSiteHome(projectId, { ownerEvidence: true }))!
      const complete = ['verified', 'optional entry', 'verified retained controls', 'same-page step'].includes(mode)
      expect(home.cards.find(card => card.id === 'conversion')).toMatchObject({ state: complete ? 'healthy' : 'unknown',
        incompleteReason: complete ? null : expect.any(String) })
      expect(home.presentation.result.state).toBe(complete ? 'clear' : 'could_not_verify')
      expect((await loadSiteSummaries(userId))[0].presentation.result).toEqual(home.presentation.result)
      expect(await getOwnedRun(userId, runId)).toMatchObject({ result: complete ? 'CLEAR' : 'COULD_NOT_VERIFY' })
      expect((await loadSiteNotificationSummaries(userId))[0].notification.incomplete).toBe(!complete)
      expect(await prisma.auditVerificationReceipt.findMany({ where: { auditId }, orderBy: { id: 'asc' } })).toEqual(before)
    })

  it.each(['both devices', 'missing mobile', 'another run', 'field instead of lab', 'wrong check version', 'desktop only'] as const)(
    'projects Performance from admitted lab receipts (%s)', async mode => {
      const root = 'https://example.com/', linked = root + 'pricing'
      const audit = await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })
      const checks = mode === 'desktop only' ? { 'lcp-poor': 1 } : { 'lcp-poor': 1, 'mobile-lcp-poor': 1 }
      const executionSpec = { ...(audit.executionSpec as Prisma.JsonObject), checks, monitoringPages: [root, linked] }
      await prisma.$transaction([
        prisma.audit.update({ where: { id: auditId }, data: { executionSpec, evidenceCoverage: { desktopPageSpeed: true,
          mobilePageSpeed: mode !== 'missing mobile' && mode !== 'both devices' } } }),
        prisma.runRequest.update({ where: { id: runId }, data: { executionSpec } }),
        prisma.auditPage.create({ data: { auditId, url: linked, normalizedUrl: linked, status: 'COMPLETED', role: 'internal', position: 1 } }),
      ])
      for (const pageUrl of [root, linked]) for (const strategy of ['desktop', 'mobile'] as const) {
        const peerMobile = pageUrl === linked && strategy === 'mobile'
        if (strategy === 'mobile' && mode === 'desktop only' || peerMobile && mode === 'missing mobile') continue
        const fieldOnly = peerMobile && mode === 'field instead of lab'
        const checkModule = strategy === 'desktop' || fieldOnly ? 'performance' : 'mobile'
        const measurement = healthyDesktopPs({ strategy, diagnostics: { measurement: pageSpeedMeasurementFixture(pageUrl, strategy) } })
        const assertions = fieldOnly ? [{ key: 'inp', name: 'Field responsiveness', expected: 'At most 200ms', observed: '150ms',
          complete: true, passed: true, disposition: 'observed' }]
          : recordCheckObservations(checkModule, { url: pageUrl, metadata: null, desktop: strategy === 'desktop' ? measurement : null,
            mobile: strategy === 'mobile' ? measurement : null }).filter(assertion => assertion.key === 'lcp')
        const check = strategy === 'desktop' ? 'lcp-poor' : fieldOnly ? 'inp-poor' : 'mobile-lcp-poor'
        await prisma.auditVerificationReceipt.create({ data: { auditId, targetKey: 'module:' + checkModule,
          scopeKey: 'page:' + pageUrl + ':device:' + strategy, pageUrl, source: 'DETERMINISTIC', status: 'COMPLETED', detail: {
            kind: 'site-module-check', version: 1, module: checkModule, pageUrl, applicable: true, complete: true, passed: true, assertions,
            execution: { auditId: peerMobile && mode === 'another run' ? 'another-audit' : auditId, taskId: 'lab-' + pageUrl + strategy,
              checkVersion: 1, checkVersions: { [check]: peerMobile && mode === 'wrong check version' ? 2 : 1 },
              source: 'pagespeed-' + strategy, collectedAt: audit.completedAt!.toISOString() },
          } } })
      }
      await persistFlagDiffSummary(null, auditId)
      const home = (await loadSiteHome(projectId, { ownerEvidence: true }))!
      const complete = mode === 'both devices' || mode === 'desktop only'
      const card = home.cards.find(item => item.id === 'performance')!
      expect(card).toMatchObject({ state: complete ? 'healthy' : 'unknown', incompleteReason: complete ? null : expect.any(String) })
      if (complete) {
        const published = await prisma.audit.findUniqueOrThrow({ where: { id: auditId }, include: { pages: true, verifierExecutions: true } })
        const performance = projectCurrentSiteEvidence({ audit: published, prior: null, categories: [], flags: [], now: new Date() })
          .coverage.find(fact => fact.area === 'performance')
        expect(performance?.label).toBe(mode === 'both devices' ? SITE_BOARD_COPY.healthyEvidence.performance.both.answer
          : SITE_BOARD_COPY.healthyEvidence.performance.desktop.answer)
      }
      expect(home.presentation.result.state).toBe(complete ? 'clear' : 'could_not_verify')
      expect((await loadSiteSummaries(userId))[0].presentation.result).toEqual(home.presentation.result)
      expect(await getOwnedRun(userId, runId)).toMatchObject({ result: complete ? 'CLEAR' : 'COULD_NOT_VERIFY' })
      expect((await loadSiteNotificationSummaries(userId))[0].notification.incomplete).toBe(!complete)
    })

  it.each(['fresh', 'expired', 'unqualified historical success'] as const)('keeps delivery unknown when Tracking request evidence is %s', async freshness => {
    const pageUrl = 'https://example.com/'
    const source = await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })
    const expired = freshness === 'expired'
    const collectedAt = new Date(source.completedAt!.getTime() - (expired ? 9 * 86400_000 : 0)).toISOString()
    const executionSpec = { ...(source.executionSpec as Prisma.JsonObject), checks: { 'tracking-endpoint-http-error': 1 } }
    await prisma.$transaction([
      prisma.audit.update({ where: { id: auditId }, data: { executionSpec } }),
      prisma.runRequest.update({ where: { id: runId }, data: { executionSpec } }),
    ])
    const measured = runTrackingChecks(null, { version: 1, phase: 'page_load', durationMs: 100, truncated: false, consentInteraction: 'none',
      requests: [{ provider: 'vercel', role: 'event', hostname: 'example.com', endpoint: '/_vercel/insights/view', method: 'POST',
        phase: 'page_load', state: 'suppressed', status: null, reason: 'scanner_suppressed', atMs: 15 }] }, pageUrl, { hasAnalytics: true })
    expect(measured.assertions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'tracking-initiation', disposition: 'observed', complete: true }),
      expect.objectContaining({ key: 'tracking-provider-recording', passed: false, complete: false }),
    ]))
    const historicalSuccess = freshness === 'unqualified historical success'
    const assertions = measured.assertions.map(assertion => historicalSuccess && assertion.key === 'tracking-http-response'
      ? { ...assertion, reason: undefined, passed: true, complete: true, observed: 'The endpoint returned a successful HTTP response.' } : assertion)
    const stored = await prisma.auditVerificationReceipt.create({ data: { auditId, targetKey: 'module:measurement', scopeKey: 'page:' + pageUrl,
      pageUrl, source: 'DETERMINISTIC', status: 'COMPLETED', detail: {
        kind: 'site-module-check', version: 1, module: 'measurement', pageUrl, applicable: true, passed: false,
        complete: false, assertions,
        execution: { auditId, taskId: 'recorded-tracking', source: 'browser-network', checkVersion: 1, collectedAt },
      } } })
    await persistFlagDiffSummary(null, auditId)
    const home = (await loadSiteHome(projectId, { ownerEvidence: true }))!
    expect(home.cards.find(card => card.id === 'tracking')).toMatchObject({ state: 'unknown',
      answer: expired ? SITE_BOARD_COPY.checkOutOfDate : SITE_ACTION_COPY.execution.tracking.requestsObserved })
    if (!expired) expect(home.cards.find(card => card.id === 'tracking')?.detail).toBe(SITE_ACTION_COPY.execution.tracking.deliveryLimit)
    expect(home.presentation.result.state).toBe('could_not_verify')
    expect((await loadSiteSummaries(userId))[0].presentation.result).toEqual(home.presentation.result)
    expect(home.monitoringHistory.find(entry => entry.id === auditId)).toMatchObject({ result: 'COULD_NOT_VERIFY', completionState: 'PARTIAL' })
    expect(await getOwnedRun(userId, runId)).toMatchObject({ result: 'COULD_NOT_VERIFY', coverage: { completeness: 'PARTIAL' } })
    expect((await loadSiteNotificationSummaries(userId))[0].notification.incomplete).toBe(true)
    if (historicalSuccess) {
      const checks = await loadSiteCheckResultPage(home.site, auditId, undefined, undefined, { area: 'tracking' }, true)
      expect(checks?.results.find(result => result.assertionKey === 'tracking-http-response')).toMatchObject({ status: 'unknown' })
      expect(await prisma.auditVerificationReceipt.findUniqueOrThrow({ where: { id: stored.id } })).toEqual(stored)
    }
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
    const recommendation = home?.recommendations.find(item => item.sourceFlagId === flag.id)
    expect(recommendation).toMatchObject({ repairGuidance: 'ready' })
    expect(await loadSiteFlagDetail(home!.site, flag.id)).toMatchObject({ repairGuidance: 'ready', fix: recommendation?.fix,
      repairDefinition: { kind: 'evidence-recovery', source: 'evidence-recovery' } })
    expect(recommendation?.fix).toContain('Do not change the website based on this record.')
    expect(recommendation?.fix).not.toContain('Retained original guidance.')
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
    await classifyWatchResult(auditId)
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
      const source = await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })
      const spec = executionSpecSchema.parse({ ...(source.executionSpec as object), scope,
        category: { area: 'security', sourceAuditId: auditId, pages: [source.url] } })
      const categoryId = randomUUID(), completedAt = new Date()
      const audit = await prisma.audit.create({ data: { id: categoryId, projectId, userId, url: source.url, parentId: auditId,
        status: 'COMPLETED', completedAt, executionSpec: spec,
        pages: { create: { url: source.url, normalizedUrl: source.url, status: 'COMPLETED', role: 'homepage', position: 0 } },
        verificationReceipts: { create: [{ targetKey: 'module:security', scopeKey: 'page:' + source.url,
          status: 'COMPLETED', source: 'DETERMINISTIC', detail: securityObservation(categoryId, source.url, completedAt) }] },
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

  it.each(['another run', 'outside scope', 'mismatched ledger page', 'admitted page'] as const)(
    'uses only admitted observation times for Site assurance when an old receipt represents %s', async kind => {
      const { url, completedAt } = await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })
      const linkedPage = url + 'pricing'
      const collectedAt = new Date(completedAt!.getTime() - 9 * 86400_000)
      const admitted = kind === 'admitted page'
      if (admitted || kind === 'mismatched ledger page') {
        await prisma.auditPage.create({ data: { auditId, url: linkedPage, normalizedUrl: linkedPage,
          status: 'COMPLETED', role: 'internal', position: 1 } })
      }
      // A receipt can be attached to a run's ledger without matching the
      // observation's original run, page or admitted responsibility.
      const observedPage = kind === 'another run' ? url : linkedPage
      await prisma.auditVerificationReceipt.create({ data: { auditId, targetKey: 'module:security', scopeKey: 'retained-security',
        status: 'COMPLETED', source: 'DETERMINISTIC', pageUrl: kind === 'mismatched ledger page' ? url : observedPage,
        detail: securityObservation(kind === 'another run' ? randomUUID() : auditId, observedPage, collectedAt) } })
      // Keep a genuinely observed second page in the ledger for the mismatch
      // case, so missing coverage cannot independently make the run incomplete.
      if (kind === 'mismatched ledger page') {
        await prisma.auditVerificationReceipt.create({ data: { auditId, targetKey: 'module:security', scopeKey: 'page:' + linkedPage,
          status: 'COMPLETED', source: 'DETERMINISTIC', pageUrl: linkedPage, detail: securityObservation(auditId, linkedPage, completedAt!) } })
      }
      await persistFlagDiffSummary(null, auditId)
      const publication = await prisma.auditVerificationReceipt.findFirstOrThrow({ where: { auditId, targetKey: 'projection:flag-comparison' } })
      const home = (await loadSiteHome(projectId, { ownerEvidence: true }))!
      const checkedAt = admitted ? collectedAt : completedAt!
      expect(home.cards.find(card => card.id === 'security')).toMatchObject({ checkedAt: checkedAt.toISOString(), state: admitted ? 'unknown' : 'healthy' })
      expect(home.presentation.result.state).toBe(admitted ? 'stale' : 'clear')
      expect((await loadSiteSummaries(userId))[0].presentation.result).toEqual(home.presentation.result)
      expect(home.monitoringHistory.find(entry => entry.id === auditId)?.result).toBe(admitted ? 'COULD_NOT_VERIFY' : 'CLEAR')
      expect(await getOwnedRun(userId, runId)).toMatchObject({ result: admitted ? 'STALE' : 'CLEAR',
        validUntil: new Date(checkedAt.getTime() + 8 * 86400_000).toISOString() })
      expect(await prisma.auditVerificationReceipt.findUniqueOrThrow({ where: { id: publication.id } })).toEqual(publication)
    })

  it.each(['another run', 'outside scope', 'mismatched ledger page', 'different module', 'admitted unfinished', 'admitted unavailable'] as const)(
    'attributes a Security coverage gap only to admitted evidence (%s)', async kind => {
      const { url, completedAt } = await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })
      const linked = url + 'pricing'
      const observedPage = kind === 'outside scope' || kind === 'mismatched ledger page' ? linked : url
      const { execution, ...detail } = securityObservation(kind === 'another run' ? randomUUID() : auditId, observedPage, completedAt!)
      const unavailable = kind === 'admitted unavailable'
      const incomplete = kind === 'admitted unfinished' || unavailable
      if (kind === 'mismatched ledger page') {
        await prisma.auditPage.create({ data: { auditId, url: linked, normalizedUrl: linked, status: 'COMPLETED', role: 'internal', position: 1 } })
        await prisma.auditVerificationReceipt.create({ data: { auditId, targetKey: 'module:security', scopeKey: 'page:' + linked,
          pageUrl: linked, status: 'COMPLETED', source: 'DETERMINISTIC', detail: securityObservation(auditId, linked, completedAt!) } })
      }
      await prisma.auditVerificationReceipt.create({ data: { auditId, targetKey: 'module:security', scopeKey: 'unfinished-security',
        pageUrl: kind === 'mismatched ledger page' ? url : observedPage, status: unavailable ? 'FAILED' : 'COMPLETED', source: 'DETERMINISTIC',
        detail: { ...detail, passed: false, complete: false,
          ...(unavailable ? { failed: true, assertions: [] } : { execution }),
          ...(kind === 'different module' ? { module: 'performance', assertions: [] } : unavailable ? {} : {
            assertions: detail.assertions.map(assertion => ({ ...assertion, passed: false, complete: false })),
          }) } } })
      await persistFlagDiffSummary(null, auditId)
      const home = (await loadSiteHome(projectId, { ownerEvidence: true }))!
      expect(home.cards.find(card => card.id === 'security')).toMatchObject({ state: incomplete ? 'unknown' : 'healthy',
        incompleteReason: incomplete ? SITE_BOARD_COPY.cardCheckIncomplete : null })
      expect(home.presentation.result.state).toBe(incomplete ? 'could_not_verify' : 'clear')
      expect((await loadSiteSummaries(userId))[0].presentation.result).toEqual(home.presentation.result)
      expect(home.monitoringHistory.find(item => item.id === auditId)?.result).toBe(incomplete ? 'COULD_NOT_VERIFY' : 'CLEAR')
      expect(await getOwnedRun(userId, runId)).toMatchObject({ result: incomplete ? 'COULD_NOT_VERIFY' : 'CLEAR' })
      expect((await loadSiteNotificationSummaries(userId))[0].notification.incomplete).toBe(incomplete)
    })

  it('keeps reached page counts while publishing incomplete discovery across the Site and saved Run', async () => {
    await prisma.audit.update({ where: { id: auditId }, data: { failedModules: ['discovery'], reportCompleteness: 'PARTIAL' } })
    await persistFlagDiffSummary(null, auditId)
    const home = (await loadSiteHome(projectId, { ownerEvidence: true }))!
    expect(home.presentation.coverage).toMatchObject({ pagesReached: 1, pagesExpected: 1, complete: false })
    expect(home.presentation.categories.find(category => category.id === 'site')?.state).toBe('unknown')
    expect(home.cards.find(card => card.id === 'security')?.state).toBe('healthy')
    expect(home.presentation.result.state).toBe('could_not_verify')
    expect((await loadSiteSummaries(userId))[0].presentation.coverage).toEqual(home.presentation.coverage)
    expect(home.monitoringHistory.find(item => item.id === auditId)).toMatchObject({ result: 'COULD_NOT_VERIFY', completionState: 'PARTIAL' })
    expect(await getOwnedRun(userId, runId)).toMatchObject({ result: 'COULD_NOT_VERIFY', coverage: {
      gaps: expect.arrayContaining([{ area: 'site', reason: 'pages' }]),
    } })
    expect((await loadSiteNotificationSummaries(userId))[0].notification.incomplete).toBe(true)
  })

  it('expires broad Site evidence on daily care beside fresh uptime without rewriting its recorded conclusion', async () => {
    const checkedAt = new Date(Date.now() - 3 * 86400_000)
    const { url } = await prisma.audit.update({ where: { id: auditId }, data: { createdAt: checkedAt, completedAt: checkedAt } })
    await prisma.auditVerificationReceipt.updateMany({ where: { auditId, targetKey: 'module:security' },
      data: { detail: securityObservation(auditId, url, checkedAt) } })
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
    const refreshedId = randomUUID(), refreshedAt = new Date()
    const refreshed = await prisma.audit.create({ data: { id: refreshedId, projectId, userId, url: original.url, status: 'COMPLETED',
      completedAt: refreshedAt, executionSpec: original.executionSpec!, evidenceCoverage: {}, reportCompleteness: 'FULL',
      pages: { create: { url: original.url, normalizedUrl: original.url, status: 'COMPLETED', role: 'homepage', position: 0 } },
      verificationReceipts: { create: { targetKey: source.targetKey, scopeKey: source.scopeKey, pageUrl: source.pageUrl,
        status: source.status, source: source.source, detail: securityObservation(refreshedId, original.url, refreshedAt) } } } })
    await prisma.runRequest.create({ data: { projectId, auditId: refreshed.id, requestedByUserId: userId, source: 'WATCH',
      idempotencyKey: randomUUID(), executionSpec: original.executionSpec!, status: 'COMPLETED', completedAt: refreshed.completedAt } })
    await persistFlagDiffSummary(null, refreshed.id)
    expect((await loadSiteHome(projectId, { ownerEvidence: true }))?.presentation.result.state).toBe('clear')
    expect((await loadSiteSummaries(userId))[0].presentation.result.state).toBe('clear')
    expect(await getOwnedRun(userId, runId)).toEqual(recorded)
    expect(await prisma.auditVerificationReceipt.findUniqueOrThrow({ where: { id: publication.id } })).toEqual(publication)
  })

  it('requires the selected Outcome receipts and binding evidence in both run and Timeline', async () => {
    const url = 'https://example.com/'
    const binding = { key: 'http', version: 1, mechanism: 'HTTP_AVAILABILITY', required: true, config: { startUrl: url } }
    const sibling = { ...binding, key: 'sibling', config: { startUrl: url + 'pricing' } }
    const otherProject = await prisma.project.create({ data: { userId, name: 'Separate Site',
      url: 'https://other.example/', canonicalHost: 'other.example' } })
    const [first, second, unrelated] = await Promise.all(['first', 'second', 'other'].map(slug => prisma.siteOutcome.create({
      data: { projectId: slug === 'other' ? otherProject.id : projectId, name: slug, slug, kind: 'AVAILABILITY' },
    })))
    const executionSpec = { version: 1, scope: 'OUTCOMES', environment: 'production', targetUrl: url, checks: {}, verificationTarget: null,
      outcomes: [first, second, unrelated].map(item => ({ id: item.id, kind: item.kind, expectation: null,
        bindingPolicy: 'ALL_REQUIRED', bindings: item.id === second.id ? [binding, sibling] : [binding] })) }
    await prisma.audit.update({ where: { id: auditId }, data: { executionSpec } })
    await prisma.runRequest.update({ where: { id: runId }, data: { executionSpec,
      selections: { create: [first, second, unrelated].map(item => ({ outcomeId: item.id })) } } })
    const site = (await loadSiteRecord(projectId))!
    const timeline = async () => (await loadMonitoringHistory(site)).timeline.find(item => item.id === auditId)
    const validUntil = new Date(Date.now() + 60_000)
    const coverage = { environment: 'production', requiredBindings: ['http'], observedBindings: ['http'],
      bindings: [{ ...binding, evaluator: DEFAULT_AVAILABILITY_EVALUATOR }] }
    const completeCoverage = { ...coverage, requiredBindings: ['http', 'sibling'], observedBindings: ['http', 'sibling'],
      bindings: [binding, sibling].map(item => ({ ...item, evaluator: DEFAULT_AVAILABILITY_EVALUATOR })) }
    const receipt = { runRequestId: runId, auditId, state: 'CLEAR' as const, summary: 'Controlled positive observation',
      coverage, evidence: { reason: 'available' }, validUntil }
    const otherAudit = await prisma.audit.create({ data: { projectId: otherProject.id, userId, url: otherProject.url,
      status: 'COMPLETED', completedAt: new Date() } })
    await prisma.outcomeAssessment.createMany({ data: [
      { ...receipt, outcomeId: first.id },
      { ...receipt, outcomeId: unrelated.id, summary: 'Foreign Outcome evidence' },
      { ...receipt, outcomeId: second.id, auditId: otherAudit.id, summary: 'Foreign Audit evidence' },
    ] })
    const fencedRun = await getOwnedRun(userId, runId)
    expect(fencedRun).toMatchObject({ result: 'COULD_NOT_VERIFY', completionState: 'PARTIAL',
      outcomes: [{ outcomeId: first.id, result: 'CLEAR' }, { outcomeId: second.id, result: null, evidence: null }] })
    expect(JSON.stringify(fencedRun)).not.toContain('Foreign')
    expect(await timeline()).toMatchObject({ result: 'COULD_NOT_VERIFY', completionState: 'PARTIAL', targetLabel: 'first, second' })

    // Repair the controlled fixture and keep only the two original responsibilities.
    const secondReceipt = { runRequestId_outcomeId: { runRequestId: runId, outcomeId: second.id } }
    await prisma.outcomeAssessment.update({ where: secondReceipt,
      data: { auditId, summary: receipt.summary, coverage } })
    const ownedSpec = { ...executionSpec, outcomes: executionSpec.outcomes.slice(0, 2) }
    await prisma.runRequest.update({ where: { id: runId }, data: { executionSpec: ownedSpec } })
    await prisma.audit.update({ where: { id: auditId }, data: { executionSpec: ownedSpec } })
    expect(await getOwnedRun(userId, runId)).toMatchObject({ result: 'COULD_NOT_VERIFY', completionState: 'PARTIAL' })
    expect(await timeline()).toMatchObject({ result: 'COULD_NOT_VERIFY', completionState: 'PARTIAL' })
    await prisma.outcomeAssessment.update({ where: secondReceipt, data: {
      coverage: { ...completeCoverage, observedBindings: ['http'] },
    } })
    expect(await getOwnedRun(userId, runId)).toMatchObject({ result: 'COULD_NOT_VERIFY', completionState: 'PARTIAL' })
    expect(await timeline()).toMatchObject({ result: 'COULD_NOT_VERIFY', completionState: 'PARTIAL' })
    await prisma.outcomeAssessment.update({ where: secondReceipt, data: { coverage: completeCoverage } })
    expect(await getOwnedRun(userId, runId)).toMatchObject({ result: 'CLEAR', completionState: 'FULL' })
    expect(await timeline()).toMatchObject({ result: 'CLEAR', completionState: 'COMPLETED' })

    await prisma.outcomeAssessment.update({ where: secondReceipt, data: { state: 'FLAG',
      coverage: { ...completeCoverage, observedBindings: ['http'] }, evidence: { reason: 'http_unavailable' } } })
    expect(await getOwnedRun(userId, runId)).toMatchObject({ result: 'FLAG', completionState: 'PARTIAL',
      coverage: { gaps: [{ outcomeId: second.id, reason: 'incomplete' }] } })
    expect(await timeline()).toMatchObject({ result: 'FLAG', completionState: 'PARTIAL' })
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
      coverage: { environment: 'production', requiredBindings: [binding.key], observedBindings: [binding.key],
        bindings: [{ ...binding, evaluator: DEFAULT_AVAILABILITY_EVALUATOR }] },
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
