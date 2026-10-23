import { describe, expect, it, vi } from 'vitest'
vi.mock('../../screenshot', () => ({ getAuditBrowser: async () => { throw new Error('A missing motion sample must not open a browser') }, captureScreenshots: vi.fn() }))
import { collectionHandlers } from '../collectors'
import { readArtifact, serializeArtifact } from '../contracts'
import { applyMotionObservation, motionAssertions } from '../../checks/motion-evidence'
import { healthyMeta } from '../../__tests__/check-fixtures'
import type { TaskContext } from '../registry'
import type { CaptureMetrics } from '../../capture-metrics'

const pageUrl = 'https://example.com/pricing'
const evaluate = collectionHandlers.find(handler => handler.kind === 'motion')!.evaluate

describe('missing reduced-motion sample', () => {
  it('records an uncollected comparison and does not invent ignored motion', async () => {
    const context = { audit: { id: 'audit' }, task: { id: 'motion' }, input: { pageUrl, position: 0, primary: true, role: 'primary' },
      deadline: Date.now() + 10_000, dependencies: new Map([['browser', { workKind: 'browser', workState: 'COMPLETED', workResult: serializeArtifact('browser', {
        pageId: 'page', metadata: healthyMeta(), snapshot: { desktopUrl: null, mobileUrl: null, desktopHtml: '<html></html>',
          desktopBase64: null, mobileBase64: null, consoleErrors: [], captureStatus: { desktop: 'ok', mobile: 'ok' }, captureFailures: [] },
      }) }]]) } as unknown as TaskContext
    const artifact = readArtifact(await evaluate(context), 'motion').data
    const assertions = motionAssertions(artifact)
    expect(assertions).toHaveLength(3)
    expect(assertions.every(assertion => assertion.passed === false && assertion.complete === false)).toBe(true)
    expect(assertions.every(assertion => assertion.observed === 'Paired initial motion evidence is unavailable.')).toBe(true)
    const applied = applyMotionObservation({} as CaptureMetrics, artifact as never)
    expect(applied.motionComplete).toBe(false)
    expect(applied.motionIgnoresReducedPreference).toBeFalsy()
  })
})
