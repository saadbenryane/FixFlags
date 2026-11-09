import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { checkReceiptSchema } from './receipt'
import { JOURNEY_VERIFICATION_RULE } from './journey-evidence'
import { capturePageKey } from '../browser/observation-scope'
import { recordAssertionVerifiers, scopedAssertionForTarget } from './verification'
import { verificationEvidence } from './verification-evidence'
import { CONSOLE_VERIFICATION_RULE } from '../console-evidence'
import { commitCheckReceipt } from '../progressive/results'
import type { TaskContext } from '../progressive/registry'
import { recordedVerificationVerdict } from '../recovery-evidence'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { repairSourceSelect } from '@/lib/sites/domain/repair-source'
import { recordSearchVerifiers } from '../search/workflow'
import { searchReceiptSchema } from '../search/contracts'

const database = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
const root = 'https://example.com/'
const context = (index: number) => `journey:signup:destination:${capturePageKey(root)}:${'a'.repeat(64)}:${JSON.stringify([{ selector: '#route-' + index, label: 'Sign up' }])}`
const target = (index: number) => ({ kind: 'page', source: 'measured', device: 'desktop', context: context(index) })

database('complete bounded repair evidence in PostgreSQL', () => {
  beforeAll(() => {
    const url = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(url.pathname))
      throw new Error('Use the disposable execution verifier')
  })
  it('retains the strongest Search comparison for the frozen attempt across late results', async () => {
    const owner = await prisma.user.create({ data: { email: randomUUID() + '@example.test' } })
    try {
      const project = await prisma.project.create({ data: { userId: owner.id, name: 'Search repair proof', url: root, canonicalHost: 'example.com' } })
      const before = await prisma.audit.create({ data: { projectId: project.id, userId: owner.id, url: root, status: 'COMPLETED' } })
      const after = await prisma.audit.create({ data: { projectId: project.id, userId: owner.id, parentId: before.id, url: root, status: 'CHECKING' } })
      const policy = { policy: 'search', version: 1, kind: 'flag', reason: 'title_empty', sources: ['rendered-dom'] }
      const flag = await prisma.flag.create({ data: { auditId: before.id, checkId: 'title-missing', pageUrl: root, attentionPolicy: policy,
        source: 'DETERMINISTIC', rubric: 'REACH', severity: 'IMPORTANT', position: 0, confidence: 1,
        problem: 'Missing title', evidence: 'The rendered page has no title', fix: 'Restore the title', whyItMatters: 'Identify the page' },
      select: repairSourceSelect })
      const improvement = await prisma.improvement.create({ data: { projectId: project.id, fingerprint: 'search-title', title: 'Missing title',
        judgment: 'The rendered title is empty', expectedBenefit: 'The page can be identified', recommendedChange: 'Add the title', successCondition: 'Title is visible',
        occurrences: { create: { auditId: before.id, flagId: flag.id, kind: 'OBSERVED' } },
        attempts: { create: { sourceAuditId: before.id, builder: 'fixture', verificationAuditId: after.id } } }, include: { attempts: true } })
      await prisma.audit.update({ where: { id: after.id }, data: { executionSpec: { version: 1, engine: 'progressive-v1',
        scope: 'DIAGNOSTIC', targetUrl: root, environment: 'production', checks: { 'title-missing': 1 }, outcomes: [],
        verificationTarget: { kind: 'DIAGNOSTIC', pageUrl: root, checkId: flag.checkId!, parentAuditId: before.id, attemptId: improvement.attempts[0].id },
        verificationSourceFlagIds: [flag.id], verificationSources: { version: 1, flags: [flag] },
      } } })
      await prisma.flag.update({ where: { id: flag.id }, data: { attentionPolicy: { ...policy, sources: ['original-html'] } } })
      for (const [observed, expected] of [['unknown', 'unknown'], ['passed', 'passed'], ['unknown', 'passed'], ['failed', 'failed'], ['passed', 'failed']] as const) {
        const collectedAt = new Date().toISOString()
        const receipt = searchReceiptSchema.parse({ kind: 'search-checks', version: 1, auditId: after.id, pageUrl: root, collectedAt,
          complete: observed !== 'unknown', observations: [{ id: 'rendered-' + observed, pageUrl: root, checkId: 'title-missing', checkVersion: 1,
            name: 'Page title', collectedAt, responsibility: 'presentation', source: 'rendered-dom', disposition: observed, reason: 'title_empty',
            expected: 'Page has a title', observed, attention: policy, evidence: [], limitation: '', guidance: '' }] })
        await prisma.$transaction(tx => recordSearchVerifiers(receipt, tx))
        const exact = await prisma.auditVerificationReceipt.findFirstOrThrow({ where: { auditId: after.id, targetKey: 'check:title-missing' } })
        expect(exact.detail).toMatchObject({ verdict: expected, comparable: expected !== 'unknown', observationIds: ['rendered-' + expected] })
      }
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })).toMatchObject({ status: 'OPEN' })
    } finally { await prisma.user.delete({ where: { id: owner.id } }) }
  })
  it.each([
    { name: 'matching failure overrides a passing peer', peerVersions: undefined, peerPassed: false, healthyPeer: true, verdict: 'failed' },
    { name: 'a matching failure arrives after a passing repair summary', peerVersions: undefined, peerPassed: false, healthyPeer: true,
      verdict: 'failed', late: true },
    { name: 'omitted check cannot override a passing peer', peerVersions: {}, peerPassed: false, healthyPeer: true, verdict: 'passed' },
    { name: 'different method cannot fill a missing scope', peerVersions: { 'journey-signup-no-form': 2 }, peerPassed: true, healthyPeer: false, verdict: null },
    { name: 'a passing peer belongs to a different ledger page', peerVersions: undefined, peerPassed: true, healthyPeer: false,
      peerLedgerPage: root + 'different', verdict: null },
    { name: 'a failing peer belongs to a different ledger page', peerVersions: undefined, peerPassed: false, healthyPeer: true,
      peerLedgerPage: root + 'different', verdict: 'passed' },
    { name: 'a passing peer claims another task in the same Run', peerVersions: undefined, peerPassed: true, healthyPeer: false,
      peerTaskMismatch: true, verdict: null },
    { name: 'a failing peer claims another task in the same Run', peerVersions: undefined, peerPassed: false, healthyPeer: true,
      peerTaskMismatch: true, verdict: 'passed' },
    { name: 'a retained peer omits the task link', peerVersions: undefined, peerPassed: true, healthyPeer: false,
      peerTaskMissing: true, verdict: 'passed' },
    { name: 'the ledger uses an equivalent root URL', peerVersions: undefined, peerPassed: true, healthyPeer: false,
      peerLedgerPage: new URL(root).origin, verdict: 'passed' },
    { name: 'replay carries a different result for the same immutable receipt', peerVersions: undefined, peerPassed: true, healthyPeer: true,
      replay: true, verdict: 'passed' },
    { name: 'the live Flag expands beyond the frozen repair scope', peerVersions: undefined, peerPassed: true, healthyPeer: true, verdict: 'passed', frozen: 'expanded' },
    { name: 'a different pending attempt owns the Run', peerVersions: undefined, peerPassed: true, healthyPeer: true, verdict: 'passed', frozen: 'detached' },
  ])('qualifies each receipt before deriving repair proof when $name', async scenario => {
    const owner = await prisma.user.create({ data: { email: randomUUID() + '@example.test' } })
    try {
      const project = await prisma.project.create({ data: { userId: owner.id, name: 'Conflicting repair evidence', url: root, canonicalHost: 'example.com' } })
      const before = await prisma.audit.create({ data: { projectId: project.id, userId: owner.id, url: root, status: 'COMPLETED' } })
      const after = await prisma.audit.create({ data: { projectId: project.id, userId: owner.id, parentId: before.id, url: root, status: 'CHECKING',
        executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: root, environment: 'production',
          checks: { 'journey-signup-no-form': 1 }, outcomes: [], verificationTarget: null } } })
      const tasks = await Promise.all(['healthy', 'failed', 'last'].map(key => prisma.auditExecutionTask.create({ data: {
        auditId: after.id, targetKey: 'task:' + key, source: 'EXECUTION', status: 'RUNNING', workKind: 'journeys' } })))
      const observed = (taskId: string, index: number, passed: boolean) => checkReceiptSchema.parse({
        kind: 'site-module-check', version: 1, module: 'journeys', pageUrl: root, applicable: true, complete: true, passed,
        assertions: [{ key: 'destination-form', name: 'Signup fields', expected: 'The original route reaches signup fields',
          observed: passed ? 'Fields observed' : 'Fields still missing', passed, complete: true, context: context(index) }],
        execution: { auditId: after.id, taskId, checkVersion: 1, source: 'rendered-dom', collectedAt: new Date().toISOString() },
      })
      const peer = observed(tasks[1].id, 1, scenario.peerPassed)
      const sources = [
        ...(scenario.healthyPeer ? [observed(tasks[0].id, 1, true)] : []),
        ...(scenario.late ? [] : [{ ...peer, execution: { ...peer.execution!, checkVersions: scenario.peerVersions } }]),
      ]
      await prisma.auditVerificationReceipt.createMany({ data: sources.map((detail, index) => ({
        id: 'ordered-' + index + '-' + after.id, auditId: after.id,
        taskId: detail.execution!.taskId === peer.execution!.taskId
          ? scenario.peerTaskMissing ? null : scenario.peerTaskMismatch ? tasks[2].id : detail.execution!.taskId
          : detail.execution!.taskId,
        targetKey: 'module:journeys', scopeKey: 'route:' + index, source: 'DETERMINISTIC', status: 'COMPLETED', detail,
        pageUrl: detail.execution!.taskId === peer.execution!.taskId ? scenario.peerLedgerPage : detail.pageUrl,
      })) })
      const flag = await prisma.flag.create({ data: { auditId: before.id, checkId: 'journey-signup-no-form', pageUrl: root,
        source: 'DETERMINISTIC', rubric: 'EXPERIENCE', severity: 'IMPORTANT', position: 0, confidence: 1,
        problem: 'Original signup fields are missing', evidence: 'Both original routes lack fields', fix: 'Restore both forms',
        whyItMatters: 'Signup is unavailable', verificationRule: JOURNEY_VERIFICATION_RULE, evidenceTargets: [target(0), target(1)] } })
      const improvement = await prisma.improvement.create({ data: { projectId: project.id, fingerprint: 'conflicting-signup', title: flag.problem,
        judgment: flag.evidence, expectedBenefit: 'Signup works', recommendedChange: flag.fix, successCondition: 'Both routes have fields',
        occurrences: { create: { auditId: before.id, flagId: flag.id, kind: 'OBSERVED' } },
        attempts: { create: { sourceAuditId: before.id, builder: 'fixture',
          verificationAuditId: scenario.frozen === 'expanded' ? after.id : undefined } } }, include: { attempts: true } })
      let verificationAudit = after
      if (scenario.frozen) {
        const original = await prisma.flag.findUniqueOrThrow({ where: { id: flag.id }, select: repairSourceSelect })
        verificationAudit = await prisma.audit.update({ where: { id: after.id }, data: {
          executionSpec: { ...readExecutionSpec(after.executionSpec)!, scope: 'DIAGNOSTIC',
            verificationTarget: { kind: 'DIAGNOSTIC', pageUrl: root, checkId: flag.checkId!, parentAuditId: before.id,
              attemptId: improvement.attempts[0].id },
            verificationSourceFlagIds: [flag.id], verificationSources: { version: 1, flags: [original] } },
        } })
        if (scenario.frozen === 'expanded') await prisma.flag.update({ where: { id: flag.id },
          data: { evidenceTargets: [target(0), target(1), target(2)] } })
        else await prisma.improvementAttempt.create({ data: { improvementId: improvement.id, sourceAuditId: before.id,
          builder: 'different-attempt', verificationAuditId: after.id } })
      }
      const current = observed(tasks[2].id, 0, true)
      const commit = (task: typeof tasks[number], detail: typeof current, scope: string) =>
        prisma.$transaction(tx => commitCheckReceipt({ audit: verificationAudit, task,
        input: { pageUrl: root, position: 0, primary: true, role: 'primary' }, dependencies: new Map(), deadline: Date.now() + 1000,
        } as TaskContext, detail, tx, scope))
      await commit(tasks[2], current, ':last')
      if (scenario.replay) await commit(tasks[2], observed(tasks[2].id, 0, false), ':last')
      if (scenario.late) {
        const provisional = await prisma.auditVerificationReceipt.findFirstOrThrow({ where: { auditId: after.id, targetKey: 'check:journey-signup-no-form' } })
        expect(provisional.detail).toMatchObject({ verdict: 'passed' })
        await commit(tasks[1], peer, ':late')
        await commit(tasks[2], current, ':last')
        const originalReceipt = await prisma.auditVerificationReceipt.findFirstOrThrow({ where: {
          auditId: after.id, targetKey: 'module:journeys', scopeKey: 'page:' + root + ':last' } })
        expect(originalReceipt.detail).toMatchObject({ assertions: [{ passed: true }] })
      }
      const certificate = await prisma.auditVerificationReceipt.findFirst({ where: { auditId: after.id, targetKey: 'check:journey-signup-no-form' } })
      if (scenario.verdict && scenario.frozen !== 'detached') {
        expect(certificate?.detail).toMatchObject({ verdict: scenario.verdict, assertion: { passed: scenario.verdict === 'passed' } })
        const supportingTask = scenario.verdict === 'failed' || !scenario.healthyPeer ? tasks[1] : tasks[0]
        expect(certificate?.evidenceReference).toMatchObject({ supportingTasks: expect.arrayContaining([
          expect.objectContaining({ taskId: supportingTask.id }),
        ]) })
      } else expect(certificate).toBeNull()
      const executions = await prisma.auditVerificationReceipt.findMany({ where: { auditId: after.id } })
      expect(recordedVerificationVerdict({ auditId: after.id, executionSpec: after.executionSpec, flag, executions })).toBe(scenario.verdict)
      const live = await prisma.flag.findUniqueOrThrow({ where: { id: flag.id } })
      expect(live).toMatchObject({ status: 'OPEN' })
      if (scenario.frozen === 'expanded') {
        expect(live.evidenceTargets).toHaveLength(3)
        expect(recordedVerificationVerdict({ auditId: after.id, executionSpec: after.executionSpec, flag: live, executions })).toBeNull()
      }
    } finally { await prisma.user.delete({ where: { id: owner.id } }) }
  })
  it('reaches later observations and keeps all original conditions without transferring unrelated assertions', async () => {
    const owner = await prisma.user.create({ data: { email: randomUUID() + '@example.test' } })
    try {
      const project = await prisma.project.create({ data: { userId: owner.id, name: 'Repair evidence', url: root, canonicalHost: 'example.com' } })
      const before = await prisma.audit.create({ data: { projectId: project.id, url: root, status: 'COMPLETED' } })
      const after = await prisma.audit.create({ data: { projectId: project.id, parentId: before.id, url: root, status: 'CHECKING' } })
      const task = await prisma.auditExecutionTask.create({ data: { auditId: after.id, targetKey: 'task:journeys', source: 'EXECUTION', status: 'RUNNING' } })
      const observed = (index: number, passed = true) => checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'journeys',
        pageUrl: root, applicable: true, passed, complete: true,
        assertions: [{ key: 'destination-form', name: 'Signup fields', expected: 'The original route reaches signup fields',
          observed: passed ? 'Editable fields observed' : 'Original fields remain absent', passed, complete: true, context: context(index) }],
        execution: { auditId: after.id, taskId: task.id, checkVersion: 1, source: 'rendered-dom', collectedAt: new Date().toISOString() } })
      const rows = Array.from({ length: 330 }, (_, index) => ({ id: 'evidence-' + String(index).padStart(4, '0') + '-' + after.id,
        auditId: after.id, taskId: task.id, targetKey: 'module:journeys', scopeKey: 'route:' + index, source: 'DETERMINISTIC',
        status: 'COMPLETED' as const, detail: { ...observed(index), diagnostic: 'x'.repeat(16000),
          assertions: [...observed(index).assertions, ...Array.from({ length: 8 }, (_, extra) => ({ ...observed(index).assertions[0],
            context: context(1000 + extra), observed: 'Unrelated observation. '.repeat(75) }))] } as Prisma.InputJsonValue }))
      await prisma.auditVerificationReceipt.createMany({ data: rows })
      const current = observed(999)
      const read = vi.fn(prisma.$queryRaw.bind(prisma))
      const db = new Proxy(prisma, { get(object, key, receiver) { return key === '$queryRaw' ? read : Reflect.get(object, key, receiver) } })
      const sources = await verificationEvidence({ receipt: current, targets: [Array.from({ length: 330 }, (_, i) => target(i))],
        assertionKeys: ['destination-form'] }, db)
      expect(sources).toHaveLength(330)
      expect(read).toHaveBeenCalledTimes(3)
      const transferred = (await Promise.all(read.mock.results.map(result => result.value))).flat() as Array<{ detail: { assertions: unknown[] } }>
      expect(transferred.every(row => row.detail.assertions.length === 1)).toBe(true)
      expect(Buffer.byteLength(JSON.stringify(transferred))).toBeLessThan(Buffer.byteLength(JSON.stringify(rows)) / 10)
      const keyboardContext = `keyboard:${'a'.repeat(64)}:${'b'.repeat(64)}:page_load`
      const control = { selector: '#original', label: 'Original action', context: keyboardContext }
      const keyboard = checkReceiptSchema.parse({ ...current, module: 'keyboard', assertions: [{ ...current.assertions[0],
        key: 'focus-styles', context: undefined, targets: [control] }], execution: { ...current.execution!, source: 'keyboard' } })
      await prisma.auditVerificationReceipt.createMany({ data: [keyboard,
        { ...keyboard, assertions: keyboard.assertions.map(assertion => ({ ...assertion, context: null })) },
      ].map((detail, index) => ({ auditId: after.id, taskId: task.id, targetKey: 'module:keyboard', scopeKey: 'control:' + index,
        source: 'DETERMINISTIC', status: 'COMPLETED', detail: detail as Prisma.InputJsonValue })) })
      const controls = await verificationEvidence({ receipt: keyboard, targets: [[control]], assertionKeys: ['focus-styles'] }, prisma)
      expect(controls).toHaveLength(1)
      expect(scopedAssertionForTarget({ receipt: controls[0], checkId: 'focus-visible-missing', flag: {
        verificationRule: 'Keyboard probe: repeat navigation', evidenceTargets: [control],
      } })?.assertion.passed).toBe(true)
      const consoleReceipt = (milliseconds: number) => checkReceiptSchema.parse({ ...current, module: 'console',
        assertions: ['desktop', 'mobile'].map(device => ({ ...current.assertions[0], key: 'console-errors',
          context: `console:page_load:${device}:public:page:profile:final:window:${milliseconds}` })),
        execution: { ...current.execution!, source: 'browser-console' } })
      await prisma.auditVerificationReceipt.createMany({ data: [consoleReceipt(2000), consoleReceipt(8000)].map((detail, index) => ({
        auditId: after.id, taskId: task.id, targetKey: 'module:console', scopeKey: 'window:' + index,
        source: 'DETERMINISTIC', status: 'COMPLETED', detail,
      })) })
      const originalWindows = consoleReceipt(4000).assertions.map(assertion => ({ context: assertion.context }))
      const windows = await verificationEvidence({ receipt: consoleReceipt(2000), targets: [originalWindows], assertionKeys: ['console-errors'] }, prisma)
      expect(windows).toHaveLength(2)
      const consoleFlag = { verificationRule: CONSOLE_VERIFICATION_RULE, evidenceTargets: originalWindows }
      expect(scopedAssertionForTarget({ receipt: consoleReceipt(2000), receipts: windows, checkId: 'console-errors-some', flag: consoleFlag })?.assertion.passed).toBe(true)
      expect(scopedAssertionForTarget({ receipt: consoleReceipt(2000), checkId: 'console-errors-some', flag: consoleFlag })).toBeUndefined()
      const flagData = { auditId: before.id, checkId: 'journey-signup-no-form', pageUrl: root, source: 'DETERMINISTIC' as const,
        rubric: 'EXPERIENCE', severity: 'IMPORTANT' as const, position: 0, problem: 'Original signup fields are missing',
        evidence: 'Both original routes lack fields', fix: 'Restore both forms', whyItMatters: 'Signup is unavailable', confidence: 1,
        verificationRule: JOURNEY_VERIFICATION_RULE, evidenceTargets: [target(0), target(329)] }
      const flag = await prisma.flag.create({ data: flagData })
      const improvement = await prisma.improvement.create({ data: { projectId: project.id, fingerprint: 'original-signup',
        title: flag.problem, judgment: flag.evidence, expectedBenefit: 'Signup works', recommendedChange: flag.fix,
        successCondition: 'Both original routes have editable fields', occurrences: { create: { auditId: before.id, flagId: flag.id, kind: 'OBSERVED' } },
        attempts: { create: { sourceAuditId: before.id, builder: 'fixture' } } } })
      await prisma.$transaction(tx => recordAssertionVerifiers({ auditId: after.id, parentId: before.id, primary: true, receipt: current }, tx))
      const certificate = await prisma.auditVerificationReceipt.findFirstOrThrow({ where: { auditId: after.id, targetKey: 'check:journey-signup-no-form' } })
      expect(certificate.detail).toMatchObject({ verdict: 'passed', assertion: { passed: true } })
      expect(certificate.evidenceReference).toMatchObject({ supportingTasks: expect.arrayContaining([{ taskId: task.id, pageUrl: root,
        collectedAt: expect.any(String) }]) })
      await prisma.auditVerificationReceipt.delete({ where: { id: certificate.id } })
      await prisma.auditVerificationReceipt.update({ where: { id: rows[329].id }, data: { detail: observed(329, false) } })
      await prisma.$transaction(tx => recordAssertionVerifiers({ auditId: after.id, parentId: before.id, primary: true, receipt: current }, tx))
      expect((await prisma.auditVerificationReceipt.findFirstOrThrow({ where: { auditId: after.id, targetKey: 'check:journey-signup-no-form' } })).detail)
        .toMatchObject({ verdict: 'failed' })
      await prisma.auditVerificationReceipt.deleteMany({ where: { auditId: after.id, targetKey: 'check:journey-signup-no-form' } })
      await prisma.auditVerificationReceipt.update({ where: { id: rows[329].id }, data: { detail: { ...observed(329), complete: false,
        assertions: observed(329).assertions.map(assertion => ({ ...assertion, complete: false })) } } })
      const donor = observed(329)
      await prisma.auditVerificationReceipt.createMany({ data: [
        { ...donor, execution: { ...donor.execution!, auditId: before.id } },
        { ...donor, execution: { ...donor.execution!, source: 'keyboard' } },
        { ...donor, execution: { ...donor.execution!, checkVersion: 2 } },
        { ...donor, failed: true }, { ...donor, applicable: false },
        { ...donor, assertions: donor.assertions.map(assertion => ({ ...assertion, disposition: 'observed' })) },
      ].map((detail, index) => ({ auditId: after.id, taskId: task.id, targetKey: 'module:journeys', scopeKey: 'unqualified:' + index,
        source: 'DETERMINISTIC', status: 'COMPLETED', detail })) })
      await prisma.$transaction(tx => recordAssertionVerifiers({ auditId: after.id, parentId: before.id, primary: true, receipt: current }, tx))
      expect(await prisma.auditVerificationReceipt.count({ where: { auditId: after.id, targetKey: 'check:journey-signup-no-form' } })).toBe(0)
      expect(scopedAssertionForTarget({ receipt: current, receipts: [observed(0)], checkId: flag.checkId!, flag })).toBeUndefined()
      expect(await prisma.improvement.findUniqueOrThrow({ where: { id: improvement.id } })).toMatchObject({ status: 'PROPOSED' })
    } finally { await prisma.user.delete({ where: { id: owner.id } }) }
  })

  it('reaches attempts and original occurrences beyond the former history limits', async () => {
    const owner = await prisma.user.create({ data: { email: randomUUID() + '@example.test' } })
    try {
      const project = await prisma.project.create({ data: { userId: owner.id, name: 'Complete repair sources', url: root, canonicalHost: 'example.com' } })
      const before = await prisma.audit.create({ data: { projectId: project.id, url: root, status: 'COMPLETED' } })
      const after = await prisma.audit.create({ data: { projectId: project.id, parentId: before.id, url: root, status: 'CHECKING' } })
      const improvement = (fingerprint: string) => prisma.improvement.create({ data: { projectId: project.id, fingerprint,
        title: 'Restore the original condition', judgment: 'Observed failure', expectedBenefit: 'Working website',
        recommendedChange: 'Repair the condition', successCondition: 'Independent comparable observation passes' } })
      const unrelated = await improvement('other-attempts'), original = await improvement('original')
      await prisma.improvementAttempt.createMany({ data: Array.from({ length: 501 }, (_, index) => ({
        id: 'attempt-' + String(index).padStart(4, '0') + '-' + after.id, sourceAuditId: before.id,
        improvementId: index === 500 ? original.id : unrelated.id, builder: 'fixture',
      })) })
      const flags = Array.from({ length: 601 }, (_, index) => ({ id: 'flag-' + String(index).padStart(4, '0') + '-' + before.id,
        auditId: before.id, checkId: index === 600 ? 'security-csp-missing' : 'title-missing', pageUrl: root,
        source: 'DETERMINISTIC' as const, rubric: 'EXPERIENCE', severity: 'IMPORTANT' as const, position: index,
        problem: 'Original condition failed', evidence: 'Recorded independent observation', fix: 'Restore it', whyItMatters: 'The website is affected', confidence: 1 }))
      await prisma.flag.createMany({ data: flags })
      await prisma.improvementOccurrence.createMany({ data: flags.map((flag, index) => ({
        id: 'occurrence-' + String(index).padStart(4, '0') + '-' + before.id,
        improvementId: original.id, auditId: before.id, flagId: flag.id, kind: 'OBSERVED',
      })) })
      const receipt = checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'security-headers',
        pageUrl: root, applicable: true, passed: true, complete: true,
        assertions: [{ key: 'content-security-policy', name: 'CSP', expected: 'An enforcing CSP is present', observed: 'An enforcing CSP is present', passed: true }],
        execution: { auditId: after.id, taskId: 'http-task', checkVersion: 1, source: 'http', collectedAt: new Date().toISOString() } })
      await prisma.auditExecutionTask.create({ data: { id: receipt.execution!.taskId, auditId: after.id, targetKey: 'task:http', source: 'EXECUTION', status: 'RUNNING' } })
      await prisma.$transaction(tx => recordAssertionVerifiers({ auditId: after.id, parentId: before.id, primary: true, receipt }, tx))
      expect((await prisma.auditVerificationReceipt.findFirstOrThrow({ where: { auditId: after.id, targetKey: 'check:security-csp-missing' } })).detail)
        .toMatchObject({ verdict: 'passed', assertion: { key: 'content-security-policy' } })
      await prisma.auditVerificationReceipt.deleteMany({ where: { auditId: after.id, targetKey: 'check:security-csp-missing' } })
      await prisma.$transaction(tx => recordAssertionVerifiers({ auditId: after.id, parentId: before.id, primary: true,
        sourceFlagIds: [flags[0].id], receipt }, tx))
      expect(await prisma.auditVerificationReceipt.count({ where: { auditId: after.id, targetKey: 'check:security-csp-missing' } })).toBe(0)
      await prisma.improvementAttempt.updateMany({ where: { improvementId: original.id }, data: { outcome: 'IMPROVED' } })
      await prisma.$transaction(tx => recordAssertionVerifiers({ auditId: after.id, parentId: before.id, primary: true, receipt }, tx))
      expect(await prisma.auditVerificationReceipt.count({ where: { auditId: after.id, targetKey: 'check:security-csp-missing' } })).toBe(0)
      await prisma.improvementAttempt.create({ data: { improvementId: original.id, sourceAuditId: after.id, builder: 'later-fixture' } })
      await prisma.$transaction(tx => recordAssertionVerifiers({ auditId: after.id, parentId: before.id, primary: true, receipt }, tx))
      expect(await prisma.auditVerificationReceipt.count({ where: { auditId: after.id, targetKey: 'check:security-csp-missing' } })).toBe(0)
    } finally { await prisma.user.delete({ where: { id: owner.id } }) }
  })
})
