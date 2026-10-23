import { beforeEach, describe, expect, it, vi } from 'vitest'
const probe = vi.hoisted(() => ({ runSlowReplay: vi.fn() }))
vi.mock('../../flow/slow-replay-probe', () => ({ runSlowReplay: probe.runSlowReplay }))
vi.mock('../../pipeline/mode', () => ({ resolveAuditPipelineMode: async () => 'FULL' }))
vi.mock('../../scan-access-store', () => ({ resolveAuditScanAccess: async () => null }))
vi.mock('../../screenshot', () => ({ getAuditBrowser: async () => ({}) }))
import { actionHandlers } from '../actions'
import { readArtifact } from '../contracts'
import { SLOW_REPLAY_PROFILE } from '../../flow/slow-replay-contract'
import type { TaskContext } from '../registry'

const evaluate = actionHandlers.find(handler => handler.kind === 'slow-replay')!.evaluate
const pageUrl = 'https://example.com/'
function context(): TaskContext {
  return { audit: { id: 'audit', projectId: null, executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: pageUrl,
    environment: 'production', scope: 'SITE', checks: { 'slow-3g-blank-screen': 1, 'slow-3g-cta-delayed': 1 }, outcomes: [], verificationTarget: null } },
    task: { id: 'slow', workGeneration: 1 }, input: { pageUrl, position: 0, primary: true, role: 'primary' },
    deadline: Date.now() + 10_000, dependencies: new Map() } as unknown as TaskContext
}
const unavailable = { profile: SLOW_REPLAY_PROFILE, pageUrl, navigationComplete: false, reason: 'navigation_unavailable' as const, complete: false,
  timeToFirstTextMs: 30_000, timeToCtaMs: 30_000, timeToContentMs: 30_000, observedForMs: 0, textBlankThroughMs: 0, ctaAbsentThroughMs: 0,
  contentAbsentThroughMs: 0, screenshotUrls: [], captures: [], actions: [] }

beforeEach(() => { probe.runSlowReplay.mockReset() })

describe('slow connection evidence', () => {
  it('records a page that never loaded as incomplete and does not invent a timing finding', async () => {
    probe.runSlowReplay.mockResolvedValue(unavailable)
    const artifact = readArtifact(await evaluate(context()), 'slow-replay').data
    expect(artifact.flags).toEqual([])
    expect(artifact.receipt).toMatchObject({ applicable: true, passed: false, complete: false,
      limitation: 'The slow connection page was not collected. Timing remains unknown.',
      assertions: [
        { key: 'meaningful-text', passed: false, complete: false },
        { key: 'primary-action-visibility', passed: false, complete: false },
      ] })
  })

  it('still retries an interrupted observation', async () => {
    probe.runSlowReplay.mockResolvedValue({ ...unavailable, reason: 'interrupted' })
    await expect(evaluate(context())).rejects.toMatchObject({ code: 'SLOW_REPLAY_INTERRUPTED', retryable: true })
  })

  it('still flags content that was measured late on the slow connection', async () => {
    probe.runSlowReplay.mockResolvedValue({ ...unavailable, navigationComplete: true, reason: 'observation_incomplete', complete: true,
      timeToFirstTextMs: 30_000, textBlankThroughMs: 9900, contentAbsentThroughMs: 9900, timeToCtaMs: 1000, ctaAbsentThroughMs: 900,
      scope: { pageUrl, finalUrl: pageUrl, profile: 'mobile-native-fixture', access: 'public' } })
    const artifact = readArtifact(await evaluate(context()), 'slow-replay').data
    expect(artifact.flags.map((flag: { checkId: string }) => flag.checkId)).toEqual(['slow-3g-blank-screen'])
    expect(artifact.receipt.complete).toBe(true)
  })
})
