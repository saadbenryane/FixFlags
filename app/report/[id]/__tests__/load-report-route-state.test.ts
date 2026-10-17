import { beforeEach, describe, expect, it, vi } from 'vitest'

const getProgressiveAuditForRequest = vi.hoisted(() => vi.fn())
const getGatedAuditForRequest = vi.hoisted(() => vi.fn())
const resolveActiveAttachedWorkId = vi.hoisted(() => vi.fn())
const auditFindMany = vi.hoisted(() => vi.fn())
const auditFindUnique = vi.hoisted(() => vi.fn())
const redirect = vi.hoisted(() =>
  vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`)
  }),
)

vi.mock('@/lib/audit/fetch-audit', () => ({
  getProgressiveAuditForRequest,
  getGatedAuditForRequest,
  resolveActiveAttachedWorkId,
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    audit: {
      findFirst: vi.fn(),
      findMany: auditFindMany,
      findUnique: auditFindUnique,
    },
  },
}))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
  redirect,
}))

import { firstAttentionFlagIndex } from '@/lib/report/explorer-filters'
import { observationsForFlag, readSupportingObservations } from '@/lib/audit/flag-observations'
import {
  loadCompletedReviewHistoryRows,
  loadReportRouteState,
} from '@/app/report/[id]/load-report-route-state'

describe('loadReportRouteState progressive handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolveActiveAttachedWorkId.mockImplementation(async (id: string) => id)
  })

  it('redirects a parent bookmark to the in-flight attached Update review', async () => {
    resolveActiveAttachedWorkId.mockResolvedValueOnce('child-active')

    await expect(
      loadReportRouteState(Promise.resolve({ id: 'parent-completed' })),
    ).rejects.toThrow('NEXT_REDIRECT:/report/child-active')
    expect(getProgressiveAuditForRequest).not.toHaveBeenCalled()
  })

  it('returns the lightweight progressive state without loading the completed graph', async () => {
    const audit = {
      id: 'audit-1',
      url: 'https://example.com/',
      status: 'CAPTURING',
      progress: 20,
      screenshots: [],
      rubrics: [],
      flags: [],
    }
    const session = { user: { id: 'user-1' } }
    getProgressiveAuditForRequest.mockResolvedValue({
      kind: 'progressive',
      audit,
      session,
      accessContext: 'owner',
      capabilities: { canViewPromptBodies: true },
    })

    const state = await loadReportRouteState(Promise.resolve({ id: 'audit-1' }))

    expect(state).toMatchObject({
      kind: 'running',
      id: 'audit-1',
      audit: { ...audit, accessContext: 'owner' },
      session,
      atAuditLimit: false,
      projection: {
        kind: 'running',
        visibility: 'owner',
        review: { id: 'audit-1' },
      },
    })
    expect(getGatedAuditForRequest).not.toHaveBeenCalled()
  })

  it('redirects a signed-in owner with a Site to /sites/{id}', async () => {
    getProgressiveAuditForRequest.mockResolvedValue({
      kind: 'progressive',
      audit: {
        id: 'audit-owned',
        url: 'https://example.com/',
        status: 'CAPTURING',
        progress: 20,
        projectId: 'site_owned',
        screenshots: [],
        rubrics: [],
        flags: [],
      },
      session: { user: { id: 'user-1' } },
      accessContext: 'owner',
      capabilities: { canViewPromptBodies: true },
    })

    await expect(
      loadReportRouteState(Promise.resolve({ id: 'audit-owned' })),
    ).rejects.toThrow('NEXT_REDIRECT:/sites/site_owned')
  })

  it('polls the work audit id when progressive data is for attached work', async () => {
    const audit = {
      id: 'child-work',
      url: 'https://example.com/',
      status: 'CHECKING',
      progress: 40,
      screenshots: [],
      rubrics: [],
      flags: [],
    }
    getProgressiveAuditForRequest.mockResolvedValue({
      kind: 'progressive',
      audit,
      session: null,
      accessContext: 'owner',
      capabilities: { canViewPromptBodies: true },
    })

    const state = await loadReportRouteState(Promise.resolve({ id: 'child-work' }))

    expect(state).toMatchObject({
      kind: 'running',
      id: 'child-work',
    })
  })

  it('scopes Product history to the current project without an account-wide cap', async () => {
    auditFindMany.mockResolvedValueOnce([])

    await loadCompletedReviewHistoryRows({
      auditId: 'review-2',
      userId: 'user-1',
      projectId: 'product-1',
    })

    expect(auditFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          projectId: 'product-1',
          userId: 'user-1',
          status: 'COMPLETED',
        },
      }),
    )
    expect(auditFindMany.mock.calls[0]?.[0]).not.toHaveProperty('take')
  })

  it('walks a legacy parent chain without loading unrelated account Reviews', async () => {
    const root = {
      id: 'review-1',
      userId: 'user-1',
      projectId: null,
      parentId: null,
      recheckTrigger: null,
      score: 60,
      status: 'COMPLETED',
      createdAt: new Date('2026-08-01T00:00:00Z'),
      completedAt: new Date('2026-08-01T00:01:00Z'),
    }
    const update = {
      ...root,
      id: 'review-2',
      parentId: 'review-1',
      score: 74,
      createdAt: new Date('2026-08-02T00:00:00Z'),
      completedAt: new Date('2026-08-02T00:01:00Z'),
    }
    auditFindUnique
      .mockResolvedValueOnce(update)
      .mockResolvedValueOnce(root)
    auditFindMany
      .mockResolvedValueOnce([update])
      .mockResolvedValueOnce([])

    const rows = await loadCompletedReviewHistoryRows({
      auditId: 'review-2',
      userId: 'user-1',
      projectId: null,
    })

    expect(rows.map((row) => row.id).sort()).toEqual(['review-1', 'review-2'])
    expect(auditFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          parentId: { in: ['review-1'] },
          userId: 'user-1',
          status: 'COMPLETED',
        },
      }),
    )
  })

  it('carries original supporting evidence and current search priority through the completed loader and copied handoff', async () => {
    const page = 'https://example.com/'
    const base = { id: 'native-1', checkId: 'buttons-no-text', rubric: 'EXPERIENCE', severity: 'IMPORTANT', impactTag: 'ACCESSIBILITY',
      problem: 'Unnamed button', evidence: 'First recorded button has no accessible name.', whyItMatters: 'Its purpose has no programmatic name.',
      fix: 'Name the original button.', agentPrompt: null, cursorPrompt: null, claudePrompt: null, windsurfPrompt: null,
      lovablePrompt: null, boltPrompt: null, verificationRule: null, pageUrl: page, affectedPaths: [], confidence: 0.9,
      source: 'DETERMINISTIC', status: 'OPEN', evidenceTargets: [] }
    const first = { ...base, supportingObservations: observationsForFlag(base,
      { auditId: 'a1', taskId: 't1', collectedAt: '2026-10-17T03:00:00.000Z', checkVersion: 1 }) }
    const other = { ...base, id: 'native-2', pageUrl: page + 'pricing', evidence: 'Second recorded button has no accessible name.' }
    const second = { ...other, supportingObservations: observationsForFlag(other,
      { auditId: 'a1', taskId: 't2', collectedAt: '2026-10-17T03:01:00.000Z', checkVersion: 1 }) }
    const policy = { policy: 'search', version: 3, kind: 'flag', reason: 'recorded_indexing_regression',
      google: { property: 'private-property', dateRange: 'private-range' } }
    const search = { ...base, id: 'search-regression', checkId: 'robots-blocks-indexing', rubric: 'REACH', impactTag: 'SEO', severity: 'CRITICAL',
      problem: 'Previously indexable page is blocked', attentionPolicy: policy }
    const nativeFunnel = { ...base, id: 'no-content', checkId: 'journey-funnel-dead-end', source: 'JOURNEY', fingerprint: 'journey-observation:v1::content' }
    const malformed = { ...base, id: 'unreadable', severity: 'CRITICAL', supportingObservations: { version: 9, items: [] } }
    const flags = [first, second, search, nativeFunnel, { ...nativeFunnel, id: 'no-path', fingerprint: 'journey-observation:v1::path' }, malformed]
    getProgressiveAuditForRequest.mockResolvedValue({ kind: 'completed' })
    getGatedAuditForRequest.mockResolvedValue({ kind: 'ok', accessContext: 'owner', isLoggedIn: false, session: null,
      showDeterministicFixes: true, showPrescription: false, sampleFixFlag: null,
      audit: { id: 'a1', url: page, status: 'COMPLETED', projectId: null, userId: null, parentId: null,
        score: null, pageType: null, flags, rubricRows: [], rubrics: [], screenshots: [], productContract: null,
        completedAt: new Date('2026-10-17T03:02:00.000Z'), reportCompleteness: 'COMPLETE', failedModules: [] } })
    const state = await loadReportRouteState(Promise.resolve({ id: 'a1' }))
    expect(state.kind).toBe('completed')
    if (state.kind !== 'completed') throw new Error('Expected completed report')
    expect(state.flags).toHaveLength(5)
    const merged = state.flags.find(flag => flag.id === 'native-1')!
    expect(readSupportingObservations(merged.supportingObservations)?.items).toHaveLength(2)
    const copied = state.projection.explorer.flags.find(flag => flag.id === 'native-1')!.copyFixPrompt
    expect(copied).toContain(first.evidence)
    expect(copied).toContain(second.evidence)
    const unreadable = state.projection.explorer.flags.find(flag => flag.id === 'unreadable')!
    expect(unreadable.evidence).toContain(base.evidence)
    expect(unreadable.copyFixPrompt).toBe('')
    expect(unreadable.hasFixPrompt).toBe(false)
    expect(unreadable.supportingEvidenceUnreadable).toBe(true)
    const attentionIndex = firstAttentionFlagIndex(state.projection.explorer.flags)
    expect(state.projection.explorer.flags[attentionIndex]!.id).not.toBe('unreadable')
    expect(state.projection.agentMessages.some(item => item.flagId === 'unreadable')).toBe(false)
    expect(state.flags.find(flag => flag.id === 'unreadable')!.supportingObservations).toEqual(malformed.supportingObservations)
    expect(state.projection.agentMessages.some(item => item.flagId === 'search-regression')).toBe(true)
    const publicPolicy = state.projection.explorer.flags.find(flag => flag.id === 'search-regression')!.attentionPolicy
    expect(publicPolicy).toEqual({ policy: 'search', version: 3, kind: 'flag', reason: 'recorded_indexing_regression' })
    expect(JSON.stringify(publicPolicy)).not.toContain('private-property')
  })

  it('preserves access denial before any completed-report work', async () => {
    getProgressiveAuditForRequest.mockResolvedValue({ kind: 'forbidden' })

    await expect(
      loadReportRouteState(Promise.resolve({ id: 'private-audit' }))
    ).resolves.toEqual({ kind: 'forbidden' })
    expect(getGatedAuditForRequest).not.toHaveBeenCalled()
  })
})
