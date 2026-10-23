import { beforeEach, describe, expect, it, vi } from 'vitest'
const probe = vi.hoisted(() => ({ scan: vi.fn(), close: vi.fn(), dispose: vi.fn(), refused: true }))
vi.mock('../../flow/run-flow-scan', () => ({ runFlowScan: probe.scan }))
vi.mock('../../scan-access-store', () => ({ resolveAuditScanAccess: async () => null }))
vi.mock('../../screenshot', () => ({ getAuditBrowser: async () => ({}) }))
vi.mock('../evaluators', () => ({ browserEvidence: () => null }))
vi.mock('../../browser/page-session', () => ({ createAuditPage: async (_browser: unknown, url: string, options: { onSafetyRefusal?: (reason: string) => void }) => {
  if (probe.refused) options.onSafetyRefusal?.('protected_action_requires_fixture')
  return { page: { url: () => url, context: () => ({ close: probe.close }) }, setTrackingPhase: () => undefined,
    tracking: () => undefined, networkFailures: [], formProbe: { result: null, probed: false }, disposeNetwork: probe.dispose }
} }))
import { actionHandlers } from '../actions'
import { readArtifact } from '../contracts'
import type { TaskContext } from '../registry'

const pageUrl = 'https://example.com/'
const handler = actionHandlers.find(handler => handler.kind === 'flow')!
function context(): TaskContext {
  return { audit: { id: 'audit', projectId: null, executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: pageUrl,
    environment: 'production', scope: 'SITE', checks: { 'flow-cta-404': 1 }, outcomes: [], verificationTarget: null } },
    task: { id: 'flow', workGeneration: 1 }, input: { pageUrl, position: 0, primary: false, role: 'secondary' },
    deadline: Date.now() + 10_000, dependencies: new Map() } as unknown as TaskContext
}
beforeEach(() => { vi.clearAllMocks(); probe.refused = true })

describe('flow observations after a protected action refusal', () => {
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
