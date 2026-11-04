import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { capturePageKey } from '@/lib/audit/browser/observation-scope'
import { JOURNEY_VERIFICATION_RULE } from '@/lib/audit/checks/journey-evidence'
import { loadRecordedJourneyConditions, originalJourneyConditions } from '../journey/recorded-conditions'
import { loadRecordedSlowActions, originalSlowActions } from '@/lib/audit/flow/recorded-slow-actions'
import { SLOW_REPLAY_PROFILE, SLOW_REPLAY_VERIFICATION_RULE } from '@/lib/audit/flow/slow-replay-contract'
import { recordedMatchingContexts } from '../recorded-targets'
import { publicLinkContext, PUBLIC_LINK_VERIFICATION_RULE } from '../checks/destination-evidence'
import { serializeArtifact } from '../progressive/contracts'
import { OBSERVATION_TARGET } from '../progressive/observation-progress'

const root = 'https://example.com/'
const context = (pageUrl: string, route: string, profile = 'a'.repeat(64)) =>
  `journey:signup:destination:${capturePageKey(pageUrl)}:${profile}:${JSON.stringify([{ selector: route, label: 'Sign up' }])}`
const target = (value: string) => ({ kind: 'page', source: 'measured', device: 'desktop', label: 'Signup fields', context: value })

describe('original journey conditions', () => {
  it('does not read historical targets before a Site identity exists', async () => {
    const read = vi.fn().mockRejectedValue(new Error('No Site history exists'))
    expect(await recordedMatchingContexts({ projectId: '', environment: 'production', verificationRule: PUBLIC_LINK_VERIFICATION_RULE },
      new Set([publicLinkContext(root, root + 'first')]), { $queryRaw: read })).toEqual(new Set())
    expect(read).not.toHaveBeenCalled()
  })
  it('keeps grouped original routes and deduplicates profiles without borrowing another page or rule', () => {
    const retained = context(root, '#original'), peer = context(root + 'peer', '#peer')
    const observations = { version: 1, items: [{ source: 'JOURNEY', checkId: 'journey-signup-no-form', checkVersion: 1,
      pageUrl: root, evidence: 'Recorded signup fields', verificationRule: JOURNEY_VERIFICATION_RULE,
      evidenceTargets: [target(retained)], provenance: null }] }
    expect(originalJourneyConditions([
      { verificationRule: 'Other rule', evidenceTargets: [target(context(root, '#wrong'))], supportingObservations: observations },
      { verificationRule: JOURNEY_VERIFICATION_RULE, evidenceTargets: [target(context(root, '#original', 'b'.repeat(64))), target(peer), { context: 'journey:unscoped' }] },
    ], root)).toEqual([{ journeyType: 'signup', phase: 'destination', pageKey: capturePageKey(root), route: [{ selector: '#original', label: 'Sign up' }] }])
  })
  it('retains grouped slow actions once per observed identity and keeps the source page boundary through redirects', () => {
    const action = (pageUrl: string, captureKey: string, href = 'https://example.com/start') => ({ kind: 'element', source: 'measured', device: 'mobile',
      selector: '#action', label: 'Get started', context: JSON.stringify({ profile: SLOW_REPLAY_PROFILE,
        pageUrl: root + 'destination', href, captureKey, sourcePageKey: capturePageKey(pageUrl) }) })
    const source = { verificationRule: SLOW_REPLAY_VERIFICATION_RULE, evidenceTargets: [action(root, 'a'.repeat(64)),
      action(root, 'b'.repeat(64)), action(root + 'other', 'c'.repeat(64))] }
    const grouped = { verificationRule: 'Other rule', evidenceTargets: [], supportingObservations: { version: 1, items: [{ source: 'DETERMINISTIC',
      checkId: 'slow-3g-cta-delayed', checkVersion: 1, pageUrl: root, evidence: 'Original delayed control',
      verificationRule: SLOW_REPLAY_VERIFICATION_RULE, evidenceTargets: [action(root, 'd'.repeat(64), root + 'second')], provenance: null }] } }
    const actions = originalSlowActions([source, grouped], root)
    expect(actions).toHaveLength(2)
    expect(actions.map(action => JSON.parse(action.context))).toEqual([
      { profile: SLOW_REPLAY_PROFILE, pageUrl: root + 'destination', href: root + 'start' },
      { profile: SLOW_REPLAY_PROFILE, pageUrl: root + 'destination', href: root + 'second' },
    ])
  })
})

const database = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
database('recorded journey monitoring responsibility', () => {
  beforeAll(() => {
    const url = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(url.pathname))
      throw new Error('Use the disposable execution verifier')
  })
  it.each(['task', 'checkpoint'] as const)('retains committed %s targets independently of whole-analysis completion', async kind => {
    const owner = 'early-targets-' + randomUUID()
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test' } })
    try {
      const project = await prisma.project.create({ data: { userId: owner, name: 'Committed target history', url: root, canonicalHost: 'example.com' } })
      const other = await prisma.project.create({ data: { userId: owner, name: 'Other target history', url: root, canonicalHost: 'other.example.com' } })
      const source = (projectId = project.id, environment = 'production', scope = 'SITE') => prisma.audit.create({ data: {
        projectId, userId: owner, url: root, status: kind === 'task' ? 'CHECKING' : 'FAILED', executionSpec: { version: 1, scope, environment },
      } })
      const original = await source(), current = await source()
      const keptJourney = context(root, '#committed'), keptLink = publicLinkContext(root, root + 'committed')
      const slowTarget = { kind: 'element', source: 'measured', device: 'mobile', selector: '#committed', label: 'Get started',
        context: JSON.stringify({ profile: SLOW_REPLAY_PROFILE, pageUrl: root, href: root + 'start', sourcePageKey: capturePageKey(root) }) }
      const findings = [
        { checkId: 'journey-signup-no-form', verificationRule: JOURNEY_VERIFICATION_RULE, evidenceTargets: [target(keptJourney)] },
        { checkId: 'slow-3g-cta-delayed', verificationRule: SLOW_REPLAY_VERIFICATION_RULE, evidenceTargets: [slowTarget] },
        { checkId: 'broken-internal-links', verificationRule: PUBLIC_LINK_VERIFICATION_RULE, evidenceTargets: [target(keptLink)] },
      ].map(flag => ({ ...flag, source: 'DETERMINISTIC', rubric: 'EXPERIENCE', severity: 'IMPORTANT', pageUrl: root,
        problem: 'Committed original failure', evidence: 'PRIVATE_COMMITTED_EVIDENCE', fix: 'Repair it', confidence: 1 }))
      async function artifact(auditId: string, committed = true) {
        const data = serializeArtifact('check', { flags: findings }) as import('@prisma/client').Prisma.InputJsonValue
        const task = await prisma.auditExecutionTask.create({ data: { auditId, targetKey: 'task:original', source: 'EXECUTION', pageUrl: root,
          status: kind === 'task' && committed ? 'COMPLETED' : 'RUNNING', workKind: 'check', workState: kind === 'task' && committed ? 'COMPLETED' : 'RUNNING', workResult: data } })
        if (kind === 'checkpoint') await prisma.auditVerificationReceipt.create({ data: { auditId, taskId: task.id, targetKey: OBSERVATION_TARGET,
          scopeKey: 'first-batch', source: 'EXECUTION', status: committed ? 'COMPLETED' : 'RUNNING', detail: data } })
      }
      await artifact(original.id)
      const before = await prisma.audit.findUniqueOrThrow({ where: { id: original.id } })
      expect((await loadRecordedJourneyConditions({ projectId: project.id, environment: 'production', pageUrl: root, excludeAuditId: current.id }))
        .map(condition => condition.route[0].selector)).toEqual(['#committed'])
      expect(await loadRecordedSlowActions({ projectId: project.id, environment: 'production', pageUrl: root, excludeAuditId: current.id }))
        .toEqual([{ selector: '#committed', label: 'Get started', context: JSON.stringify({ profile: SLOW_REPLAY_PROFILE, pageUrl: root, href: root + 'start' }) }])
      expect(await recordedMatchingContexts({ projectId: project.id, environment: 'production', excludeAuditId: current.id,
        verificationRule: PUBLIC_LINK_VERIFICATION_RULE }, new Set([keptLink]))).toEqual(new Set([keptLink]))
      await prisma.auditVerificationReceipt.deleteMany({ where: { auditId: original.id } })
      await prisma.auditExecutionTask.deleteMany({ where: { auditId: original.id } })
      await artifact(original.id, false)
      for (const audit of [await source(other.id), await source(project.id, 'staging'), await source(project.id, 'production', 'FIXTURE_SETUP'), current])
        await artifact(audit.id)
      expect(await loadRecordedJourneyConditions({ projectId: project.id, environment: 'production', pageUrl: root, excludeAuditId: current.id })).toEqual([])
      expect(await loadRecordedSlowActions({ projectId: project.id, environment: 'production', pageUrl: root, excludeAuditId: current.id })).toEqual([])
      expect(await recordedMatchingContexts({ projectId: project.id, environment: 'production', excludeAuditId: current.id,
        verificationRule: PUBLIC_LINK_VERIFICATION_RULE }, new Set([keptLink]))).toEqual(new Set())
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: original.id } })).toEqual(before)
      expect(await prisma.flag.count({ where: { auditId: original.id } })).toBe(0)
    } finally { await prisma.user.delete({ where: { id: owner } }) }
  })
  it('matches only current contexts without transferring repeated historical display evidence', async () => {
    const owner = 'matching-history-' + randomUUID()
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test' } })
    try {
      const project = await prisma.project.create({ data: { userId: owner, name: 'Matched context history', url: root, canonicalHost: 'example.com' } })
      const other = await prisma.project.create({ data: { userId: owner, name: 'Other context history', url: root, canonicalHost: 'other.example.com' } })
      const source = (environment = 'production', scope = 'SITE', projectId = project.id, status = 'COMPLETED' as 'COMPLETED' | 'CAPTURING') =>
        prisma.audit.create({ data: { projectId, url: root, status, executionSpec: { version: 1, environment, scope } } })
      const original = await source(), current = await source()
      const retained = publicLinkContext(root, root + 'original'), grouped = publicLinkContext(root, root + 'grouped')
      const flag = (auditId: string, value: string, position = 0) => ({ auditId, checkId: 'broken-internal-links', pageUrl: root,
        source: 'DETERMINISTIC' as const, rubric: 'REACH', severity: 'IMPORTANT' as const, position, confidence: 1,
        problem: 'A declared link failed', evidence: 'Original response', fix: 'Restore the destination', whyItMatters: 'Navigation is unavailable',
        status: 'FIXED' as const, verificationRule: PUBLIC_LINK_VERIFICATION_RULE,
        evidenceTargets: [{ ...target(value), label: 'PRIVATE_HISTORY_' + position, text: 'Historical display evidence '.repeat(20) }] })
      await prisma.flag.createMany({ data: Array.from({ length: 600 }, (_, position) => flag(original.id, retained, position)) })
      await prisma.flag.create({ data: { ...flag(original.id, 'unrelated'), verificationRule: 'Another rule', supportingObservations: { version: 1,
        items: [{ source: 'DETERMINISTIC', checkId: 'broken-internal-links', checkVersion: 1, pageUrl: root, evidence: 'Grouped original response',
          verificationRule: PUBLIC_LINK_VERIFICATION_RULE, evidenceTargets: [target(grouped)], provenance: null }] } } })
      const excluded = [await source('staging'), await source('production', 'FIXTURE_SETUP'),
        await source('production', 'SITE', other.id), await source('production', 'SITE', project.id, 'CAPTURING'), current]
      const excludedContexts = excluded.map((_, index) => publicLinkContext(root, root + 'excluded-' + index))
      for (const [index, audit] of excluded.entries()) await prisma.flag.create({ data: flag(audit.id, excludedContexts[index]) })
      const read = vi.fn(prisma.$queryRaw.bind(prisma))
      const matched = await recordedMatchingContexts({ projectId: project.id, environment: 'production', excludeAuditId: current.id,
        verificationRule: PUBLIC_LINK_VERIFICATION_RULE }, new Set([retained, grouped, ...excludedContexts]),
      { $queryRaw: <T>(query: TemplateStringsArray | import('@prisma/client').Prisma.Sql, ...values: unknown[]) => read(query, ...values) as Promise<T> })
      expect([...matched].sort()).toEqual([retained, grouped].sort())
      expect(read).toHaveBeenCalledTimes(1)
      const rows = await read.mock.results[0].value as Array<{ target: unknown }>
      expect(rows).toHaveLength(2)
      expect(rows.every(row => Object.keys(row.target as object).join() === 'context')).toBe(true)
      expect(JSON.stringify(rows)).not.toContain('PRIVATE_HISTORY')
      expect(await prisma.flag.count({ where: { auditId: original.id } })).toBe(601)
      process.stdout.write(JSON.stringify({ syntheticDisplayTargets: 601, returnedContextRows: rows.length,
        returnedBytes: Buffer.byteLength(JSON.stringify(rows)), historyReads: read.mock.calls.length }) + '\n')
      // Every still-declared responsibility survives beyond one read batch.
      // This synthetic cohort does not claim six hundred real browser checks.
      const cohort = Array.from({ length: 600 }, (_, index) => publicLinkContext(root, root + 'cohort-' + index))
      await prisma.flag.createMany({ data: cohort.map((value, index) => flag(original.id, value, 1000 + index)) })
      read.mockClear()
      const all = await recordedMatchingContexts({ projectId: project.id, environment: 'production', excludeAuditId: current.id,
        verificationRule: PUBLIC_LINK_VERIFICATION_RULE }, new Set([retained, ...cohort]),
      { $queryRaw: <T>(query: TemplateStringsArray | import('@prisma/client').Prisma.Sql, ...values: unknown[]) => read(query, ...values) as Promise<T> })
      expect([...all].sort()).toEqual([retained, ...cohort].sort())
      expect(read).toHaveBeenCalledTimes(2)
      expect(await prisma.flag.count({ where: { auditId: original.id } })).toBe(1201)
    } finally { await prisma.user.delete({ where: { id: owner } }) }
  })
  it('keeps repaired slow actions after later observations without spending the native sample on duplicate captures', async () => {
    const owner = 'slow-history-' + randomUUID()
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test' } })
    try {
      const project = await prisma.project.create({ data: { userId: owner, name: 'Slow action history', url: root, canonicalHost: 'example.com' } })
      const source = await prisma.audit.create({ data: { projectId: project.id, url: root, status: 'COMPLETED',
        executionSpec: { version: 1, scope: 'SITE', environment: 'production' } } })
      const flag = (pageUrl: string, index: number) => ({ auditId: source.id, checkId: 'slow-3g-cta-delayed', pageUrl,
        source: 'DETERMINISTIC' as const, rubric: 'EXPERIENCE', severity: 'IMPORTANT' as const, position: index,
        problem: 'Original action is delayed', evidence: 'Original slow connection observation', fix: 'Render it earlier',
        whyItMatters: 'The action is unavailable', confidence: 1, status: 'FIXED' as const,
        verificationRule: SLOW_REPLAY_VERIFICATION_RULE, evidenceTargets: [{ kind: 'element', source: 'measured', device: 'mobile',
          selector: '#original', label: 'Get started', context: JSON.stringify({ profile: SLOW_REPLAY_PROFILE,
            pageUrl, href: root + 'start', captureKey: index.toString(16).padStart(64, '0'), sourcePageKey: capturePageKey(pageUrl) }) }],
      })
      await prisma.flag.createMany({ data: Array.from({ length: 540 }, (_, i) => flag(root, i)) })
      await prisma.flag.createMany({ data: Array.from({ length: 130 }, (_, i) => flag(root + 'unrelated-' + i, 1000 + i)) })
      expect(await loadRecordedSlowActions({ projectId: project.id, environment: 'production', pageUrl: root, excludeAuditId: 'current' }))
        .toEqual([{ selector: '#original', label: 'Get started', context: JSON.stringify({ profile: SLOW_REPLAY_PROFILE, pageUrl: root, href: root + 'start' }) }])
    } finally { await prisma.user.delete({ where: { id: owner } }) }
  })
  it('retains old and grouped routes across unrelated findings and separates Site, environment and unfinished observations', async () => {
    const owner = 'journey-history-' + randomUUID()
    await prisma.user.create({ data: { id: owner, email: owner + '@example.test' } })
    try {
      const project = await prisma.project.create({ data: { userId: owner, name: 'Journey history', url: root, canonicalHost: 'example.com' } })
      const other = await prisma.project.create({ data: { userId: owner, name: 'Other Site', url: root, canonicalHost: 'other.example.com' } })
      const source = async (environment = 'production', scope = 'SITE', projectId = project.id, status = 'COMPLETED' as 'COMPLETED' | 'CAPTURING') =>
        prisma.audit.create({ data: { projectId, url: root, status, executionSpec: { version: 1, environment, scope } } })
      const original = await source()
      const flag = (auditId: string, value: string) => ({ auditId, checkId: 'journey-signup-no-form', pageUrl: root,
        rubric: 'EXPERIENCE', source: 'JOURNEY' as const, severity: 'IMPORTANT' as const, position: 0,
        problem: 'No signup fields', evidence: 'Recorded destination', fix: 'Restore the fields', whyItMatters: 'Signup is unavailable',
        confidence: 1, verificationRule: JOURNEY_VERIFICATION_RULE, evidenceTargets: [{ ...target(value),
          label: 'PRIVATE_JOURNEY_HISTORY', text: 'Historical display evidence '.repeat(40) }] })
      const retained = await prisma.flag.create({ data: { ...flag(original.id, context(root, '#original')), status: 'FIXED' } })
      const grouped = await prisma.flag.create({ data: { ...flag(original.id, context(root + 'peer', '#representative')),
        supportingObservations: { version: 1, items: [{ source: 'JOURNEY', checkId: 'journey-signup-no-form', checkVersion: 1,
          pageUrl: root, evidence: 'Original second route', verificationRule: JOURNEY_VERIFICATION_RULE,
          evidenceTargets: [target(context(root, '#grouped'))], provenance: null }] } } })
      const newer = await source()
      await prisma.flag.createMany({ data: Array.from({ length: 130 }, (_, i) => ({
        ...flag(newer.id, context(root + 'unrelated-' + i, '#unrelated')), createdAt: new Date(Date.now() + i),
      })) })
      // Many profiles of the same route exercise bounded keyset traversal without
      // growing the set of future browser walks or loading full Flag payloads.
      await prisma.flag.createMany({ data: Array.from({ length: 520 }, (_, i) =>
        flag(newer.id, context(root, '#original', i.toString(16).padStart(64, '0')))) })
      await prisma.flag.createMany({ data: Array.from({ length: 300 }, (_, i) => ({
        ...flag(newer.id, context(root, '#original')),
        evidenceTargets: [{ ...target(context(root, '#original')), label: 'PRIVATE_JOURNEY_HISTORY_' + i }],
      })) })
      for (const audit of [await source('staging'), await source('production', 'SITE', other.id),
        await source('production', 'FIXTURE_SETUP'), await source('production', 'SITE', project.id, 'CAPTURING')])
        await prisma.flag.create({ data: flag(audit.id, context(root, '#excluded')) })
      await prisma.flag.create({ data: { ...flag(original.id, context(root, '#wrong-rule')), verificationRule: 'Historical heuristic' } })
      const current = await source()
      await prisma.flag.create({ data: flag(current.id, context(root, '#current')) })
      const read = vi.spyOn(prisma, '$queryRaw')
      try {
        const conditions = await loadRecordedJourneyConditions({ projectId: project.id, environment: 'production', pageUrl: root, excludeAuditId: current.id })
        expect(conditions.map(condition => condition.route[0].selector).sort()).toEqual(['#grouped', '#original'])
        expect(read).toHaveBeenCalledTimes(2)
        let returnedTargets = 0
        for (const result of read.mock.results) {
          const rows = await result.value as Array<{ target: unknown }>
          returnedTargets += rows.length
          expect(rows.length).toBeLessThanOrEqual(512)
          expect(rows.every(row => Object.keys(row).join() === 'target')).toBe(true)
          expect(rows.every(row => Object.keys(row.target as object).join() === 'context')).toBe(true)
          expect(JSON.stringify(rows)).not.toContain('PRIVATE_JOURNEY_HISTORY')
        }
        expect(returnedTargets).toBe(653)
      } finally { read.mockRestore() }
      expect((await loadRecordedJourneyConditions({ projectId: project.id, environment: 'staging', pageUrl: root, excludeAuditId: current.id }))
        .map(condition => condition.route[0].selector)).toEqual(['#excluded'])
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: retained.id } })).toEqual(retained)
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: grouped.id } })).toEqual(grouped)
    } finally { await prisma.user.delete({ where: { id: owner } }) }
  })
})
