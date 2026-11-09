import { beforeEach, describe, expect, it, vi } from 'vitest'
const probe = vi.hoisted(() => ({ scan: vi.fn(), close: vi.fn(), dispose: vi.fn(), refused: true,
  failures: [] as import('../../browser/network-monitor').NetworkFailureRecord[],
  engagement: { version: 1, requests: [], truncated: false } as import('../../network-engagement-evidence').EngagementEvidence,
  tracking: undefined as import('../../tracking/contracts').TrackingEvidence | undefined }))
vi.mock('../../flow/run-flow-scan', () => ({ runFlowScan: probe.scan }))
vi.mock('../../scan-access-store', () => ({ resolveAuditScanAccess: async () => null }))
vi.mock('../../screenshot', () => ({ getAuditBrowser: async () => ({}) }))
vi.mock('../evaluators', () => ({ browserEvidence: () => null }))
vi.mock('../../browser/page-session', () => ({ createAuditPage: async (_browser: unknown, url: string, options: { onSafetyRefusal?: (reason: string) => void }) => {
  if (probe.refused) options.onSafetyRefusal?.('protected_action_requires_fixture')
  return { page: { url: () => url, context: () => ({ close: probe.close }) }, setTrackingPhase: () => undefined, setPublicActionControl: () => undefined,
    tracking: () => probe.tracking, engagement: () => probe.engagement, settleNetwork: async () => undefined,
    networkFailures: probe.failures, formProbe: null, disposeNetwork: probe.dispose }
} }))
import { actionHandlers } from '../actions'
import { readArtifact } from '../contracts'
import type { TaskContext } from '../registry'
import { trackingRequestKey } from '../../tracking/identity'

const pageUrl = 'https://example.com/'
const handler = actionHandlers.find(handler => handler.kind === 'flow')!
function context(): TaskContext {
  return { audit: { id: 'audit', projectId: null, executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: pageUrl,
    environment: 'production', scope: 'SITE', checks: { 'flow-cta-404': 1 }, outcomes: [], verificationTarget: null } },
    task: { id: 'flow', workGeneration: 1 }, input: { pageUrl, position: 0, primary: false, role: 'secondary' },
    deadline: Date.now() + 10_000, dependencies: new Map() } as unknown as TaskContext
}
beforeEach(() => { vi.clearAllMocks(); probe.refused = true; probe.failures = []; probe.engagement = { version: 1, requests: [], truncated: false }; probe.tracking = undefined })

describe('flow observations after a protected action refusal', () => {
  it('keeps a measured library error when the public action walk cannot finish', async () => {
    probe.refused = false
    probe.scan.mockResolvedValue({ status: 'skipped', steps: [], finalUrl: pageUrl })
    probe.tracking = { version: 1, phase: 'public_action', requests: [{ provider: 'vercel', role: 'library', hostname: 'example.com',
      endpoint: '/_vercel/insights/script.js', method: 'GET', phase: 'public_action', state: 'response', status: 503, atMs: 1, reason: null }],
      truncated: false, durationMs: 100, consentInteraction: 'existing_flow' }
    const artifact = readArtifact(await handler.evaluate(context()), 'flow')
    expect(() => handler.validateResult(artifact)).not.toThrow()
    expect(artifact.data.flags).toMatchObject([{ checkId: 'tracking-library-http-error' }])
    expect(artifact.data.flowReceipt).toMatchObject({ complete: false, passed: false })
  })
  it.each(['skipped', 'timeout'] as const)('retains an independent recorded API failure after a %s walk without certifying action completion', async status => {
    probe.refused = false
    const destination = 'https://example.com/api/account'
    probe.failures = [{ url: destination, method: 'GET', status: 503, sameOrigin: true, engagementPath: true, resourceType: 'fetch', at: Date.now() }]
    probe.engagement = { version: 1, truncated: false, requests: [{ phase: 'page_load', method: 'GET', status: 503, state: 'completed',
      destination, requestKey: trackingRequestKey(destination, 'GET'), captureKey: 'b'.repeat(64) }] }
    probe.scan.mockResolvedValue({ status, steps: [], finalUrl: pageUrl })
    const artifact = readArtifact(await handler.evaluate(context()), 'flow')
    expect(() => handler.validateResult(artifact)).not.toThrow()
    expect(artifact.data.flags).toEqual(expect.arrayContaining([expect.objectContaining({ checkId: 'api-engagement-server-error',
      evidenceTargets: [expect.objectContaining({ context: expect.stringContaining('engagement:page_load:control:page:') })] })]))
    expect(artifact.data.networkReceipt).toMatchObject({ passed: false,
      assertions: expect.arrayContaining([expect.objectContaining({ key: 'engagement-server-response', passed: false, complete: true })]) })
    expect(artifact.data.flowReceipt).toMatchObject({ passed: false, complete: false })
    expect(probe.close).toHaveBeenCalledOnce()
    expect(probe.dispose).toHaveBeenCalledOnce()
  })
  it('returns a valid committable artifact and retains independent response evidence', async () => {
    probe.scan.mockResolvedValue({ status: 'success', steps: [], finalUrl: pageUrl, ctaText: 'Continue',
      actionEvidence: { version: 1, pageContext: 'flow:page:' + 'a'.repeat(64), controlContext: 'flow:control:' + 'b'.repeat(64),
        candidateCount: 1, clicked: true, clickBlocked: false, navigation: 'changed', responseExpected: true, response: 'healthy', httpStatus: 200 } })
    const stored = await handler.evaluate(context())
    const artifact = readArtifact(stored, 'flow')
    expect(() => handler.validateResult(artifact)).not.toThrow()
    expect(artifact.data.flowReceipt).toMatchObject({ complete: false, passed: false, assertions: expect.arrayContaining([
      expect.objectContaining({ key: 'primary-action-response', complete: true, passed: true }),
      expect.objectContaining({ key: 'public-action-boundary', complete: false, passed: false }),
    ]) })
    expect(artifact.data.receipt).toMatchObject({ module: 'measurement' })
    expect(probe.close).toHaveBeenCalledOnce()
    expect(probe.dispose).toHaveBeenCalledOnce()
  })

  it('does not turn a refused click into a broken-button finding or discard the limitation', async () => {
    probe.scan.mockResolvedValue({ status: 'unclickable', steps: [], finalUrl: pageUrl, ctaText: 'Submit' })
    const artifact = readArtifact(await handler.evaluate(context()), 'flow')
    expect(artifact.data.flags).toEqual([])
    expect(artifact.data.flowReceipt).toMatchObject({ complete: false, passed: false })
  })

  it('retains a native HTTP failure even when another action was refused', async () => {
    probe.scan.mockResolvedValue({ status: 'error_response', steps: [], finalUrl: pageUrl, ctaText: 'Continue', httpStatus: 404,
      actionEvidence: { version: 1, pageContext: 'flow:page:' + 'a'.repeat(64), controlContext: 'flow:control:' + 'b'.repeat(64),
        candidateCount: 1, clicked: true, clickBlocked: false, navigation: 'changed', responseExpected: true, response: 'error', httpStatus: 404 } })
    const artifact = readArtifact(await handler.evaluate(context()), 'flow')
    expect(artifact.data.flags).toEqual(expect.arrayContaining([expect.objectContaining({ checkId: 'flow-cta-404' })]))
    expect(artifact.data.flowReceipt).toMatchObject({ complete: false, passed: false })
  })

  it('still retries an unavailable collection when there was no refused action', async () => {
    probe.refused = false
    probe.scan.mockResolvedValue({ status: 'skipped', steps: [], finalUrl: pageUrl })
    await expect(handler.evaluate(context())).rejects.toMatchObject({ code: 'FLOW_EXECUTION_UNAVAILABLE', retryable: true })
    expect(probe.close).toHaveBeenCalledOnce()
  })
})
