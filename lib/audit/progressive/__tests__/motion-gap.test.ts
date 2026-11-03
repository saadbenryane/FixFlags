import { describe, expect, it, vi } from 'vitest'
vi.mock('../../screenshot', () => ({ getAuditBrowser: async () => { throw new Error('A missing motion sample must not open a browser') }, captureScreenshots: vi.fn() }))
import { collectionHandlers } from '../collectors'
import { readArtifact, serializeArtifact } from '../contracts'
import { applyMotionObservation, motionAssertions, motionObservationSchema, MOTION_VERIFICATION_RULE, type MotionObservation } from '../../checks/motion-evidence'
import { healthyMeta } from '../../__tests__/check-fixtures'
import type { TaskContext } from '../registry'
import { evaluatorHandlers } from '../evaluators'
import { checkArtifactSchema } from '../results'
import { scopedAssertionForTarget } from '../../checks/verification'

const pageUrl = 'https://example.com/pricing'
const evaluate = collectionHandlers.find(handler => handler.kind === 'motion')!.evaluate

describe('missing reduced-motion sample', () => {
  it('uses paired motion observations without layout metrics and keeps recovery independent of unknown loading', async () => {
    const target = { family: 'css' as const, selector: '#original', label: 'Original effect', sample: 'transform' }
    const window = { version: 1 as const, pageUrl, complete: true, windowMs: 2000, observedMs: 2200, restricted: false, contentVisible: true }
    const observed: MotionObservation = { version: 1, scope: { pageUrl, finalUrl: pageUrl, profile: 'mobile-profile', access: 'public' },
      before: { ...window, reduced: false, targets: [target], contentVisible: false }, after: { ...window, reduced: true, targets: [target] } }
    const context = (motion?: MotionObservation) => ({
      audit: { id: 'audit', executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: pageUrl, scope: 'SITE', environment: 'production',
        checks: { 'motion-ignores-reduced-preference': 1 }, outcomes: [], verificationTarget: null } }, task: { id: 'check' },
      input: { pageUrl, position: 0, primary: true, role: 'primary', module: 'interaction' }, deadline: Date.now() + 10_000,
      dependencies: new Map<string, unknown>([
        ['browser', { workKind: 'browser', workState: 'COMPLETED', workInput: { device: 'mobile' }, workResult: serializeArtifact('browser', {
          pageId: 'page', metadata: null, snapshot: { desktopUrl: null, mobileUrl: null, desktopHtml: null, desktopBase64: null, mobileBase64: null,
            consoleErrors: [], captureStatus: { desktop: 'pending', mobile: 'pending' }, captureFailures: [], captureMetrics: null },
        }) }], ...(motion ? [['motion', { workKind: 'motion', workState: 'COMPLETED', workResult: serializeArtifact('motion', motion) }]] : []),
      ]),
    } as unknown as TaskContext)
    const evaluate = async (motion?: MotionObservation) => checkArtifactSchema.parse(readArtifact(
      await evaluatorHandlers.find(handler => handler.kind === 'check')!.evaluate(context(motion)), 'check').data)
    const failed = await evaluate(observed), flag = failed.flags[0]
    expect(failed.flags).toHaveLength(1)
    expect(flag).toMatchObject({ checkId: 'motion-ignores-reduced-preference', verificationRule: MOTION_VERIFICATION_RULE,
      evidenceTargets: [expect.objectContaining({ selector: '#original', device: 'mobile' })] })
    expect(failed.receipt).toMatchObject({ complete: false, passed: false })
    expect(failed.receipt.assertions.find(assertion => assertion.key === 'blocking-loading-ui')).toMatchObject({ complete: false, passed: false })
    const repaired = structuredClone(observed)
    repaired.before.contentVisible = true; repaired.after.targets = []
    const healthy = await evaluate(repaired)
    expect(healthy.flags).toEqual([])
    expect(scopedAssertionForTarget({ receipt: healthy.receipt, checkId: flag.checkId, flag })?.assertion).toMatchObject({ complete: true, passed: true })
    repaired.after.contentVisible = false
    expect(scopedAssertionForTarget({ receipt: (await evaluate(repaired)).receipt, checkId: flag.checkId, flag })).toBeUndefined()
    expect(await evaluate()).toMatchObject({ flags: [], receipt: { complete: false, passed: false } })
  })

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
    const applied = applyMotionObservation({}, motionObservationSchema.parse(artifact))
    expect(applied.motionComplete).toBe(false)
    expect(applied.motionIgnoresReducedPreference).toBeFalsy()
  })
})
