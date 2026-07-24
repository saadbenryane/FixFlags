import assert from 'node:assert/strict'
import { beforeEach, describe, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  loadRepoFlagsForAudit: vi.fn(),
}))

vi.mock('@/lib/audit/repo-rankable-flags', async () => {
  const actual = await vi.importActual<typeof import('@/lib/audit/repo-rankable-flags')>(
    '@/lib/audit/repo-rankable-flags'
  )
  return {
    ...actual,
    loadRepoFlagsForAudit: mocks.loadRepoFlagsForAudit,
  }
})

import { buildFixList } from '@/lib/audit/finish-plan'
import { buildUnifiedFixList } from '@/lib/audit/load-finish-plan-flags'
import { repoFindingToRankableFlag } from '@/lib/audit/repo-rankable-flags'

describe('fix list surface parity', () => {
  const liveFlag = {
    id: 'live-1',
    checkId: 'cta-specificity',
    rubric: 'MESSAGE',
    severity: 'MEDIUM',
    impactTag: 'CONVERSION',
    problem: 'Primary CTA is vague',
    evidence: 'Button says Continue',
    whyItMatters: 'Vague CTAs reduce conversion',
    fix: 'Name the outcome',
    agentPrompt: 'Rename the primary CTA.',
    cursorPrompt: null,
    claudePrompt: null,
    windsurfPrompt: null,
    lovablePrompt: null,
    boltPrompt: null,
    verificationRule: 'CTA names the outcome',
    pageUrl: 'https://example.com/',
    confidence: 0.9,
    source: 'DETERMINISTIC',
  }

  const repoFinding = repoFindingToRankableFlag({
    id: 'repo-1',
    severity: 'CRITICAL',
    category: 'secret',
    filePath: '.env',
    problem: 'Exposed API key in repository',
    evidence: 'sk_live_***',
    fix: 'Remove and rotate',
    agentPrompt: 'Remove secret from .env',
    cursorPrompt: null,
    claudePrompt: null,
    windsurfPrompt: null,
  })

  beforeEach(() => {
    mocks.loadRepoFlagsForAudit.mockReset()
    mocks.loadRepoFlagsForAudit.mockResolvedValue([repoFinding])
  })

  it('returns the same ordered unresolved Flag IDs for report API and unified loader', async () => {
    const sharedInput = {
      userId: 'user-1',
      auditUrl: 'https://example.com/',
      flags: [liveFlag],
      rubricRows: [{ name: 'MESSAGE', grade: 'B' }],
      contract: null,
      promptAccess: 'all' as const,
    }

    const apiFixList = await buildUnifiedFixList(sharedInput)
    const reportLoaderFixList = await buildUnifiedFixList(sharedInput)

    assert.deepEqual(
      apiFixList.items.map((item) => item.id),
      reportLoaderFixList.items.map((item) => item.id)
    )
    assert.equal(apiFixList.items[0]?.id, 'repo:repo-1')
    assert.equal(apiFixList.items[1]?.id, 'live-1')
  })

  it('includes Agency repo Flags that live-only buildFixList omits', async () => {
    const liveOnly = buildFixList({
      flags: [{ ...liveFlag, whyItMatters: undefined }],
      rubricRows: [{ name: 'MESSAGE', grade: 'B' }],
      url: 'https://example.com/',
      promptAccess: 'all',
    })
    const unified = await buildUnifiedFixList({
      userId: 'user-1',
      auditUrl: 'https://example.com/',
      flags: [liveFlag],
      rubricRows: [{ name: 'MESSAGE', grade: 'B' }],
      promptAccess: 'all',
    })

    assert.deepEqual(liveOnly.items.map((item) => item.id), ['live-1'])
    assert.deepEqual(unified.items.map((item) => item.id), ['repo:repo-1', 'live-1'])
  })
})
