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
