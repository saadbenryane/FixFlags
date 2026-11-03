import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { capturePageKey } from '@/lib/audit/browser/observation-scope'
import { JOURNEY_VERIFICATION_RULE } from '@/lib/audit/checks/journey-evidence'
import { loadRecordedJourneyConditions, originalJourneyConditions } from '../journey/recorded-conditions'
import { loadRecordedSlowActions, originalSlowActions } from '@/lib/audit/flow/recorded-slow-actions'
import { SLOW_REPLAY_PROFILE, SLOW_REPLAY_VERIFICATION_RULE } from '@/lib/audit/flow/slow-replay-contract'

const root = 'https://example.com/'
const context = (pageUrl: string, route: string, profile = 'a'.repeat(64)) =>
  `journey:signup:destination:${capturePageKey(pageUrl)}:${profile}:${JSON.stringify([{ selector: route, label: 'Sign up' }])}`
const target = (value: string) => ({ kind: 'page', source: 'measured', device: 'desktop', label: 'Signup fields', context: value })

describe('original journey conditions', () => {
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
        confidence: 1, verificationRule: JOURNEY_VERIFICATION_RULE, evidenceTargets: [target(value)] })
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
        for (const result of read.mock.results) {
          const rows = await result.value as Array<{ target: unknown }>
          expect(rows.length).toBeLessThanOrEqual(512)
          expect(rows.every(row => Object.keys(row).join() === 'target')).toBe(true)
        }
      } finally { read.mockRestore() }
      expect((await loadRecordedJourneyConditions({ projectId: project.id, environment: 'staging', pageUrl: root, excludeAuditId: current.id }))
        .map(condition => condition.route[0].selector)).toEqual(['#excluded'])
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: retained.id } })).toEqual(retained)
      expect(await prisma.flag.findUniqueOrThrow({ where: { id: grouped.id } })).toEqual(grouped)
    } finally { await prisma.user.delete({ where: { id: owner } }) }
  })
})
