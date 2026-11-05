import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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
import { loadSiteFlagDetail } from '@/lib/sites/flags'
import { publishProgress } from '@/lib/audit/progressive/events'
import { readSiteEvents } from '../execution-progress'
import { loadUptimeHistory } from '@/lib/uptime/queries'
import { Client, InMemoryTransport } from '@modelcontextprotocol/client'
import { McpServer } from '@modelcontextprotocol/server'
import { registerSiteOutcomeTools } from '@/lib/mcp/tools/sites'
import { MCP_TOOLS } from '@/lib/mcp/tool-manifest'
import { siteCheckResultSchema } from '@/lib/sites/check-results'
import { z } from 'zod'
import { NATIVE_CONSTRAINT_OBSERVATION } from '@/lib/audit/checks/form-validation'

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
      verifierExecutions: { create: { targetKey: 'module:security', scopeKey: 'page:' + project.url,
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

  it.each(['incomplete', 'failed', 'native-shortcut'] as const)(
    'qualifies a historical %s receipt consistently without rewriting published evidence', async state => {
      const baseline = await prisma.audit.findUniqueOrThrow({ where: { id: auditId } }), pageUrl = baseline.url
      const spec = { ...(baseline.executionSpec as object), checks: {
        'no-https': 1, 'flow-form-no-validation': CHECK_REGISTRY['flow-form-no-validation'].version,
      } }
      await prisma.audit.update({ where: { id: auditId }, data: { executionSpec: spec, evidenceCoverage: { flowScan: true } } })
      await prisma.runRequest.update({ where: { id: runId }, data: { executionSpec: spec } })
      // A saved historical observation exercises readers and publication. It
      // does not establish that a live form was visited or safely submitted.
      const detail = { passed: true, assertions: [{ key: 'form-feedback', name: 'Feedback', expected: 'Field feedback',
        observed: 'Inline feedback appeared beside the invalid field', passed: true, complete: true }] }
      const receipt = await prisma.auditVerifierExecution.create({ data: { auditId, targetKey: 'module:form-validation',
        scopeKey: 'page:' + pageUrl, pageUrl, source: 'DETERMINISTIC', status: 'COMPLETED', detail } })
      await persistFlagDiffSummary(null, auditId)
      expect((await loadSiteHome(projectId))!.presentation.result.state).toBe('clear')
      const published = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId, targetKey: 'projection:flag-comparison' } })
      const changed = await prisma.auditVerifierExecution.update({ where: { id: receipt.id }, data: {
        detail: state === 'native-shortcut' ? { ...detail, assertions: [{ ...detail.assertions[0], observed: NATIVE_CONSTRAINT_OBSERVATION }] }
          : { passed: true, assertions: [], ...(state === 'incomplete' ? { complete: false } : { failed: true }) },
      } })
      const home = (await loadSiteHome(projectId))!
      expect(home.presentation.result.state).toBe('could_not_verify')
      expect(home.presentation.categories.find(card => card.id === 'conversion')).toMatchObject({ state: 'unknown' })
      expect((await loadSiteSummaries(userId))[0].presentation.result.state).toBe('could_not_verify')
      const site = (await loadSiteRecord(projectId))!
      const results = await loadSiteCheckResultPage(site, auditId)
      expect(results.results.filter(result => result.evidenceReference.executionId === receipt.id)
        .every(result => result.status === 'unknown')).toBe(true)
      expect(results.results.some(result => result.area === 'security' && result.status === 'passed')).toBe(true)
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
      const server = new McpServer({ name: 'historical-evidence', version: '1.0.0' }, { capabilities: { tools: {} } })
      const client = new Client({ name: 'historical-reader', version: '1.0.0' })
      registerSiteOutcomeTools(server, await prisma.user.findUniqueOrThrow({ where: { id: userId } }))
      try {
        await server.connect(serverTransport); await client.connect(clientTransport)
        const response = await client.callTool({ name: MCP_TOOLS.listOutcomes.name, arguments: { siteId: projectId } })
        const payload = z.object({ checkResults: siteCheckResultSchema.array() }).parse(response.structuredContent)
        const checks = payload.checkResults.filter(result => result.evidenceReference.executionId === receipt.id)
        expect(checks.length).toBe(state === 'native-shortcut' ? 2 : 1)
        expect(checks.every(result => result.status === 'unknown')).toBe(true)
      } finally { await client.close(); await server.close() }
      expect(await getOwnedRun(userId, runId)).toMatchObject({ result: 'CLEAR' })
      expect(home.monitoringHistory.find(entry => entry.id === auditId)).toMatchObject({ result: 'CLEAR' })
      expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: receipt.id } })).toEqual(changed)
      expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: published.id } })).toEqual(published)
      await prisma.auditVerifierExecution.update({ where: { id: receipt.id }, data: { detail } })
      expect((await loadSiteHome(projectId))!.presentation.result.state).toBe('clear')
    })

  it.each(['missing', 'unsupported', 'running'] as const)('retains a %s page-module receipt as incomplete despite recorded collection success', async state => {
    const baseline = await prisma.audit.findUniqueOrThrow({ where: { id: auditId } }), pageUrl = baseline.url
    const spec = { ...(baseline.executionSpec as object), checks: { 'no-https': 1, 'title-missing': CHECK_REGISTRY['title-missing'].version } }
    await prisma.audit.update({ where: { id: auditId }, data: { executionSpec: spec, evidenceCoverage: { metadata: true } } })
    await prisma.runRequest.update({ where: { id: runId }, data: { executionSpec: spec } })
    const detail = { kind: 'site-module-check', version: 1, module: 'metadata', pageUrl, applicable: true, complete: true, passed: true,
      assertions: [{ key: 'title-presence', name: 'Title', expected: 'A title is recorded', observed: 'Publication fixture', complete: true, passed: true }] }
    const receipt = await prisma.auditVerifierExecution.create({ data: { auditId, targetKey: 'module:metadata', scopeKey: 'page:' + pageUrl,
      pageUrl, source: 'DETERMINISTIC', status: 'COMPLETED', detail } })
    await persistFlagDiffSummary(null, auditId)
    expect((await loadSiteHome(projectId))!.presentation.result.state).toBe('clear')
    const changed = await prisma.auditVerifierExecution.update({ where: { id: receipt.id }, data: {
      status: state === 'running' ? 'RUNNING' : 'COMPLETED',
      detail: state === 'missing' ? Prisma.JsonNull : state === 'unsupported' ? { ...detail, version: 99 } : detail,
    } })
    const home = (await loadSiteHome(projectId))!
    expect(home.presentation.result.state).toBe('could_not_verify')
    expect((await loadSiteSummaries(userId))[0].presentation.result.state).toBe('could_not_verify')
    expect(home.checkResults!.filter(result => result.evidenceReference.executionId === receipt.id).every(result => result.status === 'unknown')).toBe(true)
    expect(await getOwnedRun(userId, runId)).toMatchObject({ result: 'CLEAR' })
    expect(home.monitoringHistory.find(entry => entry.id === auditId)).toMatchObject({ result: 'CLEAR' })
    expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: receipt.id } })).toEqual(changed)
    await prisma.auditVerifierExecution.update({ where: { id: receipt.id }, data: { detail, status: 'COMPLETED' } })
    expect((await loadSiteHome(projectId))!.presentation.result.state).toBe('clear')
  })

  it.each(['unreadable', 'failed', 'running', 'wrong-page', 'wrong-audit'] as const)(
    'keeps %s Search evidence unavailable across current readers without rewriting its published history', async state => {
      const baseline = await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })
      const spec = { ...(baseline.executionSpec as object), checks: { 'no-https': 1, 'title-missing': CHECK_REGISTRY['title-missing'].version } }
      await prisma.audit.update({ where: { id: auditId }, data: { executionSpec: spec, evidenceCoverage: { metadata: true } } })
      await prisma.runRequest.update({ where: { id: runId }, data: { executionSpec: spec } })
      const observedAt = baseline.completedAt!.toISOString(), pageUrl = baseline.url
      const detail = { kind: 'search-checks', version: 1, auditId, pageUrl, complete: true, collectedAt: observedAt,
        observations: [{ id: 'recorded-title', checkId: 'title-missing', checkVersion: 1, responsibility: 'presentation', name: 'Page title',
          disposition: 'passed', reason: 'title_recorded', expected: 'A title is present', observed: 'Publication fixture',
          source: 'rendered-dom', collectedAt: observedAt, pageUrl, evidence: [], limitation: 'Controlled saved observation', guidance: '',
          attention: { policy: 'search', version: 1, kind: 'observation', reason: 'title_recorded' } }] }
      const receipt = await prisma.auditVerifierExecution.create({ data: { auditId, targetKey: 'module:search', scopeKey: 'page:' + pageUrl,
        pageUrl, source: 'DETERMINISTIC', status: 'COMPLETED', detail } })
      await persistFlagDiffSummary(null, auditId)
      const publication = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId, targetKey: 'projection:flag-comparison' } })
      expect((await loadSiteHome(projectId))!.presentation.result.state).toBe('clear')
      const changed = await prisma.auditVerifierExecution.update({ where: { id: receipt.id }, data: {
        status: state === 'failed' ? 'FAILED' : state === 'running' ? 'RUNNING' : 'COMPLETED',
        pageUrl: state === 'wrong-page' ? pageUrl + 'another-page' : pageUrl,
        detail: state === 'unreadable' ? { ...detail, version: 99 } : state === 'wrong-audit' ? { ...detail, auditId: 'another-audit' } : detail,
      } })
      const home = (await loadSiteHome(projectId))!
      expect(home.presentation.result.state).toBe('could_not_verify')
      expect(home.presentation.categories.find(card => card.id === 'search')).toMatchObject({ state: 'unknown' })
      expect((await loadSiteSummaries(userId))[0].presentation.result.state).toBe('could_not_verify')
      expect(home.checkResults!.filter(result => result.area === 'search').some(result => result.status === 'passed')).toBe(false)
      expect(await getOwnedRun(userId, runId)).toMatchObject({ result: 'CLEAR' })
      expect(home.monitoringHistory.find(entry => entry.id === auditId)).toMatchObject({ result: 'CLEAR' })
      expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: receipt.id } })).toEqual(changed)
      expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: publication.id } })).toEqual(publication)
      await prisma.auditVerifierExecution.update({ where: { id: receipt.id }, data: { status: receipt.status, pageUrl: receipt.pageUrl, detail } })
      expect((await loadSiteHome(projectId))!.presentation.result.state).toBe('clear')
    })

  it.each(['COMPLETED', 'CAPTURING', 'FAILED', 'legacy-request', 'conflicting-requests', 'healthy-preview'] as const)(
    'retains production evidence beside a newer %s analysis in another environment', async state => {
      const time = Date.now(), baseline = await prisma.audit.update({ where: { id: auditId }, data: {
        createdAt: new Date(time - 60_000), completedAt: new Date(time - 50_000),
      } })
      if (state !== 'healthy-preview') await persistFlagDiffSummary(null, auditId)
      const before = (await loadSiteHome(projectId))!, summaryBefore = (await loadSiteSummaries(userId))[0]
      expect(before.presentation.result.state).toBe(state === 'healthy-preview' ? 'could_not_verify' : 'clear')
      const legacy = state === 'legacy-request' || state === 'conflicting-requests'
      const specification = { ...(baseline.executionSpec as object), environment: 'staging' }
      const newer = await prisma.audit.create({ data: { projectId, userId, url: baseline.url,
        createdAt: new Date(time - 20_000), completedAt: state === 'CAPTURING' ? null : new Date(time - 10_000),
        status: legacy || state === 'healthy-preview' ? 'COMPLETED' : state, executionSpec: legacy ? Prisma.JsonNull : specification,
      } })
      const otherRun = await prisma.runRequest.create({ data: { projectId, auditId: newer.id, requestedByUserId: userId,
        source: 'WEB', environment: 'staging', executionSpec: specification, idempotencyKey: randomUUID(),
        status: state === 'CAPTURING' ? 'RUNNING' : state === 'FAILED' ? 'FAILED' : 'COMPLETED' } })
      if (state === 'conflicting-requests') await prisma.runRequest.create({ data: { projectId, auditId: newer.id,
        requestedByUserId: userId, source: 'WEB', environment: 'production', executionSpec: baseline.executionSpec as Prisma.InputJsonValue,
        idempotencyKey: randomUUID(), status: 'COMPLETED' } })
      if (state === 'healthy-preview') {
        const original = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId, targetKey: 'module:security' } })
        await prisma.auditPage.create({ data: { auditId: newer.id, url: newer.url, normalizedUrl: newer.url,
          status: 'COMPLETED', role: 'homepage', position: 0 } })
        await prisma.auditVerifierExecution.create({ data: { auditId: newer.id, targetKey: original.targetKey, scopeKey: original.scopeKey,
          pageUrl: original.pageUrl, source: original.source, status: original.status, detail: original.detail as Prisma.InputJsonValue } })
        await persistFlagDiffSummary(null, newer.id)
        expect(await getOwnedRun(userId, otherRun.id)).toMatchObject({ result: 'CLEAR' })
      }
      const home = (await loadSiteHome(projectId))!, summary = (await loadSiteSummaries(userId))[0]
      expect(home.audit.id).toBe(auditId)
      expect(home.presentation.result).toEqual(before.presentation.result)
      expect(summary.presentation.result).toEqual(summaryBefore.presentation.result)
      expect(summary.presentation.freshness).toEqual(summaryBefore.presentation.freshness)
      if (state === 'healthy-preview') {
        const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
        const server = new McpServer({ name: 'current-environment-evidence', version: '1.0.0' }, { capabilities: { tools: {} } })
        const client = new Client({ name: 'current-site-reader', version: '1.0.0' })
        registerSiteOutcomeTools(server, await prisma.user.findUniqueOrThrow({ where: { id: userId } }))
        try {
          await server.connect(serverTransport); await client.connect(clientTransport)
          const result = await client.callTool({ name: MCP_TOOLS.listOutcomes.name, arguments: { siteId: projectId } })
          const payloadSchema = z.object({ checkResults: siteCheckResultSchema.array(), checkResultsNextCursor: z.string().nullable() })
          const payload = payloadSchema.parse(result.structuredContent), checks = payload.checkResults
          expect(checks.filter(check => !check.historical).map(check => check.auditId)).toEqual(expect.arrayContaining([auditId]))
          expect(checks.filter(check => !check.historical).every(check => check.auditId === auditId)).toBe(true)
          const cursor = payload.checkResultsNextCursor
          expect(cursor).toEqual(expect.any(String))
          const history = await client.callTool({ name: MCP_TOOLS.listOutcomes.name,
            arguments: { siteId: projectId, resultCursor: cursor } })
          const historical = payloadSchema.parse(history.structuredContent).checkResults
          expect(historical.filter(check => check.auditId === newer.id).length).toBeGreaterThan(0)
          expect(historical.filter(check => check.auditId === newer.id).every(check => check.historical)).toBe(true)
        } finally { await client.close(); await server.close() }
      }
      expect(home.monitoringHistory.some(entry => entry.id === newer.id)).toBe(state !== 'CAPTURING')
      expect(await getOwnedRun(userId, otherRun.id)).toMatchObject({ id: otherRun.id })
      // Publication can update the audit itself, but selecting current evidence
      // must never change its environment, lifecycle or recorded time.
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: newer.id } })).toMatchObject({
        executionSpec: newer.executionSpec, status: newer.status, completedAt: newer.completedAt,
      })
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
      const before = (await loadSiteHome(projectId))!
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
      const home = (await loadSiteHome(projectId))!
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

  it.each(['missing', 'unknown', 'checking', 'offline', 'stale', 'future', 'future-recovery', 'future-incident', 'online'] as const)('uses %s uptime evidence for current Site health while preserving the recorded run', async state => {
    const now = new Date()
    const future = state.startsWith('future')
    await prisma.project.update({ where: { id: projectId }, data: { watchInterval: 'WEEKLY', watchNextRunAt: new Date(now.getTime() + 86400_000) } })
    await prisma.auditVerifierExecution.create({ data: { auditId, targetKey: 'projection:flag-comparison', scopeKey: 'product',
      status: 'COMPLETED', source: 'SYSTEM', detail: { kind: 'flag-comparison', version: 1, auditId, parentAuditId: null,
        summary: { newIssues: [], unchanged: [], regressed: [], fixed: [], inconclusive: [] } } } })
    if (state !== 'missing') await prisma.uptimeMonitor.create({ data: { projectId, targetUrl: 'https://example.com/',
      state: state === 'future-incident' ? 'offline' : state === 'stale' || future ? 'online' : state,
      lastCheckedAt: new Date(now.getTime() + (future ? 3600_000 : state === 'stale' ? -11 * 60_000 : -1000)),
      nextProbeAt: new Date(now.getTime() + 5 * 60_000) } })
    const savedMonitor = await prisma.uptimeMonitor.findUnique({ where: { projectId } })
    let incidentId: string | undefined
    if (future) {
      await prisma.uptimeProbe.create({ data: { monitorId: savedMonitor!.id, targetUrl: savedMonitor!.targetUrl, version: savedMonitor!.version,
        scheduledAt: savedMonitor!.lastCheckedAt!, observedAt: savedMonitor!.lastCheckedAt!, attempt: 1,
        result: state === 'future-incident' ? 'FAILED' : 'ONLINE', reason: state === 'future-incident' ? 'response_error' : 'response_received',
        statusCode: state === 'future-incident' ? 503 : 200, durationMs: 50 } })
      if (state !== 'future') {
        const time = state === 'future-incident' ? savedMonitor!.lastCheckedAt! : new Date(now.getTime() - 60_000)
        incidentId = (await prisma.uptimeIncident.create({ data: { monitorId: savedMonitor!.id, targetUrl: savedMonitor!.targetUrl,
          version: savedMonitor!.version, reason: 'response_error', startedAt: new Date(now.getTime() - 60_000), confirmedAt: time,
          recoveredAt: state === 'future-recovery' ? savedMonitor!.lastCheckedAt! : null } })).id
      }
      const history = await loadUptimeHistory(projectId, '24h', null, now)
      expect(history).toMatchObject({ state: 'unknown', lastCheckedAt: null, probes: [], incidentOpen: state === 'future-recovery',
        openIncidentCount: state === 'future-recovery' ? 1 : 0 })
      expect(history!.segments.every(segment => segment.state === 'unknown' && segment.checked === 0)).toBe(true)
      if (state === 'future-recovery') expect(history!.incidents).toMatchObject([{ id: incidentId, recoveredAt: null }])
      else expect(history!.incidents).toEqual([])
    }
    const expected = state === 'online' ? 'clear' : state === 'offline' || state === 'future-recovery' ? 'flags' : 'could_not_verify'
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
    expect(await prisma.uptimeMonitor.findUnique({ where: { projectId } })).toEqual(savedMonitor)
    if (state === 'future-recovery') expect(await prisma.uptimeIncident.findUniqueOrThrow({ where: { id: incidentId! } }))
      .toMatchObject({ recoveredAt: savedMonitor!.lastCheckedAt })
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
    const home = (await loadSiteHome(projectId))!
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
      expect((await loadSiteHome(projectId))!.flags.some(item => item.sourceFlagId === flag.id)).toBe(false)
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
    expect((await loadSiteHome(projectId))!.flags.find(item => item.sourceFlagId === (newerFlagId ?? flag.id))?.repairGuidance).toBe('ready')
    expect(await loadSiteFlagDetail(home.site, flag.id)).toMatchObject({ repairGuidance: 'ready', fix: 'Give the original button a clear accessible name.' })
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })).toEqual(latest)
  })

  it('withholds Clear consistently until the comparison belongs to this completed execution', async () => {
    async function expectState(state: 'clear' | 'could_not_verify') {
      const outcome = state === 'clear' ? 'CLEAR' : 'COULD_NOT_VERIFY'
      expect(await getOwnedRun(userId, runId)).toMatchObject({ result: outcome })
      const home = await loadSiteHome(projectId)
      expect(home?.presentation.result.state).toBe(state)
      expect(home?.monitoringHistory.find(entry => entry.id === auditId)).toMatchObject({
        result: outcome, completionState: state === 'clear' ? 'COMPLETED' : 'PARTIAL',
      })
      expect((await loadSiteSummaries(userId))[0].presentation.result.state).toBe(state)
    }
    const before = await prisma.audit.findUniqueOrThrow({ where: { id: auditId } })
    await expectState('could_not_verify')
    expect(await prisma.auditVerifierExecution.count({ where: { auditId, targetKey: 'projection:flag-comparison' } })).toBe(0)
    const summary = { newIssues: [], unchanged: [], regressed: [], fixed: [], inconclusive: [] }
    const receipt = await prisma.auditVerifierExecution.create({ data: { auditId, targetKey: 'projection:flag-comparison', scopeKey: 'product',
      status: 'COMPLETED', source: 'SYSTEM', detail: { kind: 'flag-comparison', version: 1, auditId: 'different-audit', parentAuditId: null, summary } } })
    await expectState('could_not_verify')
    await prisma.auditVerifierExecution.update({ where: { id: receipt.id }, data: {
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
    const home = await loadSiteHome(projectId)
    expect(home?.presentation.coverage.complete).toBe(true)
    expect(home?.counts.categories.site).toBe(1)
    expect(home?.presentation.categories.find(category => category.id === 'site')).toMatchObject({
      state: 'problem', status: 'Needs a fix', flagCount: 1,
    })
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
    const home = await loadSiteHome(projectId)
    expect(home?.flags).toHaveLength(0)
    expect(home?.recommendations.find(item => item.sourceFlagId === flag.id)).toMatchObject({ supportingEvidenceUnreadable: true })
    expect(home?.recommendations.find(item => item.sourceFlagId === flag.id)).toMatchObject({ fix: '', repairGuidance: 'unavailable' })
    expect(readSiteHomeView(JSON.parse(JSON.stringify(home)), projectId).recommendations[0].supportingEvidenceUnreadable).toBe(true)
    expect(home?.presentation.result.state).toBe('could_not_verify')
    expect((await loadSiteSummaries(userId))[0].presentation.result.state).toBe('could_not_verify')
    expect(await getOwnedRun(userId, runId)).toMatchObject({ result: 'COULD_NOT_VERIFY', completionState: 'PARTIAL' })
    expect(home?.monitoringHistory.find(entry => entry.id === auditId)).toMatchObject({ result: 'COULD_NOT_VERIFY', flagCount: 0, completionState: 'PARTIAL' })
    const publication = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId, targetKey: 'projection:flag-comparison' } })
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
    const home = await loadSiteHome(projectId)
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
    expect((await loadSiteHome(projectId))?.presentation.result.state).toBe('clear')
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
        verifierExecutions: { create: [{ targetKey: 'module:security', scopeKey: 'page:' + source.url,
          status: 'COMPLETED', source: 'DETERMINISTIC', detail: source.verifierExecutions[0].detail! },
        ...initialTaskPlan(spec).map(task => ({ targetKey: 'task:' + task.key, scopeKey: task.scope, source: 'SYSTEM' as const,
          status: 'COMPLETED' as const, workState: 'COMPLETED' as const, workKind: task.kind, workDependencies: task.dependencies,
          workInput: task.input, pageUrl: task.input.pageUrl }))] } } })
      observedId = audit.id
      const request = await prisma.runRequest.create({ data: { projectId, auditId: audit.id, source: 'WEB', idempotencyKey: randomUUID(),
        status: 'COMPLETED', completedAt: audit.completedAt, executionSpec: spec } })
      requestId = request.id
      await persistFlagDiffSummary(auditId, observedId)
    }
    expect((await loadSiteHome(projectId))?.monitoringHistory.find(entry => entry.id === observedId))
      .toMatchObject({ result: 'CLEAR', completionState: 'COMPLETED' })
    expect(await getOwnedRun(userId, requestId)).toMatchObject({ result: 'CLEAR', completionState: 'FULL' })
    const original = CHECK_REGISTRY['no-https']
    const before = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: observedId, targetKey: 'projection:flag-comparison' } })
    try {
      CHECK_REGISTRY['no-https'] = { ...original, version: original.version + 1 }
      const home = await loadSiteHome(projectId)
      expect(home?.presentation.result.state).toBe('could_not_verify')
      expect((await loadSiteSummaries(userId))[0].presentation.result.state).toBe('could_not_verify')
      expect(home?.monitoringHistory.find(entry => entry.id === observedId)).toMatchObject({ result: 'CLEAR', completionState: 'COMPLETED' })
      expect(await getOwnedRun(userId, requestId)).toMatchObject({ result: 'CLEAR', completionState: 'FULL' })
      expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: before.id } })).toEqual(before)
    } finally { CHECK_REGISTRY['no-https'] = original }
  })

  it('retains the original historical Flag membership and wording after the mutable source is corrected', async () => {
    const flag = await prisma.flag.create({ data: { auditId, source: 'DETERMINISTIC', rubric: 'REACH', severity: 'IMPORTANT',
      checkId: 'no-https', problem: 'Original diagnosis', evidence: 'Recorded source evidence', whyItMatters: 'Recorded impact',
      fix: 'Recorded repair guidance', confidence: 1, position: 0, pageUrl: 'https://example.com/' } })
    await persistFlagDiffSummary(null, auditId)
    const expected = { result: 'FLAG', flagCount: 1, flags: [{ id: flag.id, title: flag.problem }] }
    expect((await loadSiteHome(projectId))?.monitoringHistory.find(entry => entry.id === auditId)).toMatchObject(expected)
    await prisma.flag.update({ where: { id: flag.id }, data: { severity: 'POLISH', problem: 'Later corrected wording', status: 'FIXED' } })
    expect((await loadSiteHome(projectId))?.monitoringHistory.find(entry => entry.id === auditId)).toMatchObject(expected)
    expect(await getOwnedRun(userId, runId)).toMatchObject({ result: 'FLAG' })
  })

  it('expires broad Site evidence on daily care beside fresh uptime without rewriting its recorded conclusion', async () => {
    const checkedAt = new Date(Date.now() - 3 * 86400_000)
    await prisma.audit.update({ where: { id: auditId }, data: { createdAt: checkedAt, completedAt: checkedAt } })
    await persistFlagDiffSummary(null, auditId)
    const publication = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId, targetKey: 'projection:flag-comparison' } })
    const recorded = await getOwnedRun(userId, runId)
    expect(recorded).toMatchObject({ result: 'CLEAR', validUntil: new Date(checkedAt.getTime() + 8 * 86400_000).toISOString() })
    expect(await setProjectWatch({ projectId, userId, interval: 'weekly' })).toMatchObject({ ok: true })
    await prisma.uptimeMonitor.upsert({ where: { projectId },
      create: { projectId, targetUrl: 'https://example.com/', state: 'online', lastCheckedAt: new Date() },
      update: { state: 'online', lastCheckedAt: new Date() } })
    expect((await loadSiteHome(projectId))?.presentation.result.state).toBe('clear')
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
    expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: publication.id } })).toEqual(publication)

    // A new controlled observation restores current assurance. The earlier
    // receipt stays untouched; this case exercises saved-state read paths.
    const original = await prisma.audit.findUniqueOrThrow({ where: { id: auditId }, include: { verifierExecutions: true } })
    const source = original.verifierExecutions.find(row => row.targetKey === 'module:security')!
    const refreshed = await prisma.audit.create({ data: { projectId, userId, url: original.url, status: 'COMPLETED',
      completedAt: new Date(), executionSpec: original.executionSpec!, evidenceCoverage: {}, reportCompleteness: 'FULL',
      pages: { create: { url: original.url, normalizedUrl: original.url, status: 'COMPLETED', role: 'homepage', position: 0 } },
      verifierExecutions: { create: { targetKey: source.targetKey, scopeKey: source.scopeKey, pageUrl: source.pageUrl,
        status: source.status, source: source.source, detail: source.detail! } } } })
    await prisma.runRequest.create({ data: { projectId, auditId: refreshed.id, requestedByUserId: userId, source: 'WATCH',
      idempotencyKey: randomUUID(), executionSpec: original.executionSpec!, status: 'COMPLETED', completedAt: refreshed.completedAt } })
    await persistFlagDiffSummary(null, refreshed.id)
    expect((await loadSiteHome(projectId))?.presentation.result.state).toBe('clear')
    expect((await loadSiteSummaries(userId))[0].presentation.result.state).toBe('clear')
    expect(await getOwnedRun(userId, runId)).toEqual(recorded)
    expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: publication.id } })).toEqual(publication)
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
    await prisma.auditVerifierExecution.create({ data: { auditId, targetKey: 'projection:flag-comparison', scopeKey: 'product', status: 'COMPLETED',
      source: 'SYSTEM', detail: { kind: 'flag-comparison', version: 1, auditId, parentAuditId: null,
        summary: { fixed: [], inconclusive: [], unchanged: [], regressed: [], newIssues: [] } } } })
    expect(await setProjectWatch({ projectId, userId, interval: 'weekly' })).toMatchObject({ ok: true })
    // This fixture varies Outcome freshness. Current Site assurance also needs
    // an independent recent reachability observation after monitoring starts.
    await prisma.uptimeMonitor.upsert({ where: { projectId }, create: { projectId, targetUrl, state: 'online', lastCheckedAt: new Date() },
      update: { state: 'online', lastCheckedAt: new Date() } })
    expect((await loadSiteHome(projectId))?.presentation.result.state).toBe('clear')
    expect((await loadSiteSummaries(userId))[0].presentation.result.state).toBe('clear')

    expect(await setProjectWatch({ projectId, userId, interval: 'hourly' })).toMatchObject({ ok: true })
    const currentUntil = new Date(assessedAt.getTime() + 13 * 3600_000).toISOString()
    const home = await loadSiteHome(projectId)
    expect(home?.outcomes.find(item => item.id === outcome.id)).toMatchObject({ state: 'STALE', validUntil: currentUntil })
    expect(home?.presentation.result.state).toBe('stale')
    expect((await loadSiteSummaries(userId))[0].presentation.result.state).toBe('stale')
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
    expect((await loadSiteHome(projectId))?.outcomes.find(item => item.id === outcome.id))
      .toMatchObject({ state: 'CLEAR', validUntil: refreshedUntil.toISOString() })
    expect((await loadSiteSummaries(userId))[0].presentation.result.state).toBe('clear')

    const changedAt = new Date()
    expect(await setProjectWatch({ projectId, userId, interval: 'weekly' }, { clock: fixedClock(changedAt) })).toMatchObject({ ok: true })
    expect(await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).toMatchObject({ watchNextRunAt: changedAt })
    expect((await loadSiteHome(projectId))?.outcomes.find(item => item.id === outcome.id))
      .toMatchObject({ state: 'CLEAR', validUntil: refreshedUntil.toISOString() })
    expect(await prisma.outcomeAssessment.findUniqueOrThrow({ where: { id: assessment.id } })).toEqual(assessment)
  })
})
