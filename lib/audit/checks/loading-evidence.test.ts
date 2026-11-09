import { describe, expect, it } from 'vitest'
import type { CaptureMetrics, PageLoadExperience } from '../capture-metrics'
import type { CheckAssertion } from './assertion'
import { runInteractionChecks } from './interaction'
import { runMobileUXQualityChecks } from './mobile-ux-quality'
import { checkReceiptSchema } from './receipt'
import { scopedAssertionForTarget } from './verification'
import { hasRecordedRecoveryEvidence } from '../recovery-evidence'
import { LOADING_VERIFICATION_RULE } from './loading-evidence'
import { evaluatorHandlers } from '../progressive/evaluators'
import { readArtifact, serializeArtifact } from '../progressive/contracts'
import { checkArtifactSchema } from '../progressive/results'
import type { TaskContext } from '../progressive/registry'

const pageUrl = 'https://example.com/'
function window(device: 'desktop' | 'mobile', clearedMs: number | null = 5200): PageLoadExperience {
  return { device, initialScreenshotUrl: null, initialCaptureElapsedMs: 100, finalCaptureElapsedMs: 6000,
    loadingVisibleAtInitial: true, loadingVisibleAtFinal: clearedMs === null, loadingClearedMs: clearedMs,
    loadingLabel: 'Hero loading', finalReadyState: 'complete', finalTitle: 'Useful page', observation: {
      version: 1, device, scope: { pageUrl, finalUrl: pageUrl, profile: device + '-profile', access: 'public' },
      ready: true, contentVisible: true, restricted: false,
    } }
}
function metrics(mobile = window('mobile'), desktop = window('desktop')): CaptureMetrics {
  return { mobilePrimaryCtaTopPx: null, mobilePrimaryCtaText: null, competingPrimaryCtaCount: 0, competingPrimaryCtaLabels: [],
    mobileViewportHeight: 800, mobileScrollY: 0, mobileDocumentHeight: 1000, stuckLoadingIndicator: mobile.loadingVisibleAtFinal,
    stuckLoadingLabel: mobile.loadingLabel, uniqueFontFamilies: 1, fontFamilySample: ['sans-serif'], buttonBorderRadii: [],
    motionIgnoresReducedPreference: false, motionSampleLabel: null, motionComplete: true, inputsBelow16px: [],
    loadExperience: mobile, desktopLoadExperience: desktop, loadingObservation: mobile.observation }
}
function receipt(data: CaptureMetrics, module = 'interaction') {
  const assertions: CheckAssertion[] = []
  if (module === 'interaction') runInteractionChecks(data, assertion => assertions.push(assertion))
  else runMobileUXQualityChecks(data, 'marketing', assertion => assertions.push(assertion))
  return checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module, pageUrl, applicable: true,
    passed: assertions.every(assertion => assertion.passed), complete: assertions.every(assertion => assertion.complete !== false), assertions,
    execution: { auditId: 'after', taskId: 'task', checkVersion: 1, source: 'rendered-dom', collectedAt: new Date().toISOString() } })
}

describe('source-conditioned loading repair evidence', () => {
  it('retains a desktop loading failure and its own comparable repair when mobile metrics are unavailable', async () => {
    const evaluate = evaluatorHandlers.find(handler => handler.kind === 'check')!.evaluate
    const context = (desktop: PageLoadExperience | null): TaskContext => ({
      audit: { id: 'after', executionSpec: { version: 1, engine: 'progressive-v1', browserCollection: 'per-profile-v1',
        scope: 'CATEGORY', targetUrl: pageUrl, environment: 'production', category: { area: 'conversion', sourceAuditId: 'before', pages: [pageUrl] },
        checks: { 'loading-state-slow': 1, 'loading-indicator-stuck': 1, 'motion-ignores-reduced-preference': 1 }, outcomes: [], verificationTarget: null } },
      task: { id: 'task' }, input: { pageUrl, position: 0, primary: true, role: 'primary', module: 'interaction' },
      deadline: Date.now() + 10_000, dependencies: new Map([
        ['p0:browser', { workKind: 'browser', workState: 'COMPLETED', workInput: { device: 'desktop' }, workResult: serializeArtifact('browser', {
          pageId: 'page', metadata: null, snapshot: { desktopUrl: null, mobileUrl: null, desktopHtml: null, desktopBase64: null, mobileBase64: null,
            consoleErrors: [], captureStatus: { desktop: 'pending', mobile: 'pending' }, captureFailures: [], captureMetrics: null, desktopLoadExperience: desktop },
        }) }], ['p0:browser-mobile', { workKind: 'browser', workState: 'EXHAUSTED' }],
      ]),
    } as unknown as TaskContext)
    const result = async (desktop: PageLoadExperience | null) => checkArtifactSchema.parse(readArtifact(await evaluate(context(desktop)), 'check').data)
    const slow = await result(window('desktop', 5200)), fast = await result(window('desktop', 500))
    const flag = slow.flags.find(flag => flag.checkId === 'loading-state-slow')!
    expect(flag).toMatchObject({ verificationRule: LOADING_VERIFICATION_RULE })
    expect(flag.evidenceTargets).toHaveLength(1)
    expect(flag.evidenceTargets![0]).toMatchObject({ device: 'desktop' })
    expect(slow.receipt).toMatchObject({ complete: false, passed: false })
    expect(slow.receipt.assertions.find(assertion => assertion.key === 'blocking-loading-ui'))
      .toMatchObject({ observed: 'Loading UI was not observed.', complete: false, passed: false })
    expect(fast.flags).toEqual([])
    expect(scopedAssertionForTarget({ receipt: fast.receipt, checkId: flag.checkId, flag })?.assertion).toMatchObject({ passed: true, complete: true })
    const bothDevices = runInteractionChecks(metrics())[0]
    expect(scopedAssertionForTarget({ receipt: fast.receipt, checkId: bothDevices.checkId, flag: bothDevices })).toBeUndefined()
    const changed = window('desktop', 500)
    changed.observation!.scope.access = 'credentialed:changed'
    expect(scopedAssertionForTarget({ receipt: (await result(changed)).receipt, checkId: flag.checkId, flag })).toBeUndefined()
    const restricted = window('desktop', 5200)
    restricted.observation!.restricted = true
    expect((await result(restricted)).flags).toEqual([])
    expect((await result(null))).toMatchObject({ flags: [], receipt: { complete: false, passed: false } })
  })

  it('retains frozen category finding admission without requiring desktop metadata', async () => {
    const data = metrics()
    data.motionIgnoresReducedPreference = true
    const context = { audit: { id: 'after', executionSpec: { version: 1, engine: 'progressive-v1', scope: 'CATEGORY', targetUrl: pageUrl,
      environment: 'production', category: { area: 'conversion', sourceAuditId: 'before', pages: [pageUrl] },
      checks: { 'motion-ignores-reduced-preference': 1 }, outcomes: [], verificationTarget: null } }, task: { id: 'task' },
      input: { pageUrl, position: 0, primary: true, role: 'primary', module: 'interaction' }, deadline: Date.now() + 10_000,
      dependencies: new Map([['browser', { workKind: 'browser', workState: 'COMPLETED', workResult: serializeArtifact('browser', {
        pageId: 'page', metadata: null, snapshot: { desktopUrl: null, mobileUrl: null, desktopHtml: null, desktopBase64: null, mobileBase64: null,
          consoleErrors: [], captureStatus: { desktop: 'failed', mobile: 'pending' }, captureFailures: [], captureMetrics: data },
      }) }]]) } as unknown as TaskContext
    const observed = checkArtifactSchema.parse(readArtifact(await evaluatorHandlers.find(handler => handler.kind === 'check')!.evaluate(context), 'check').data)
    expect(observed.flags.map(flag => flag.checkId)).toEqual(['motion-ignores-reduced-preference'])
  })
  it('requires every originally delayed device and shares the verdict with monitoring recovery', () => {
    const flag = runInteractionChecks(metrics())[0]
    expect(flag).toMatchObject({ checkId: 'loading-state-slow', verificationRule: LOADING_VERIFICATION_RULE })
    expect(flag.evidenceTargets).toHaveLength(2)
    const repaired = receipt(metrics(window('mobile', 500), window('desktop', 500)))
    expect(scopedAssertionForTarget({ receipt: repaired, checkId: flag.checkId, flag })?.assertion).toMatchObject({ passed: true, complete: true })
    const partial = receipt(metrics(window('mobile', 5200), window('desktop', 500)))
    expect(scopedAssertionForTarget({ receipt: partial, checkId: flag.checkId, flag })?.assertion).toMatchObject({ passed: false, complete: true })
    const unavailable = window('desktop', 500)
    unavailable.observation!.restricted = true
    expect(scopedAssertionForTarget({ receipt: receipt(metrics(window('mobile', 5200), unavailable)), checkId: flag.checkId, flag })?.assertion)
      .toMatchObject({ passed: false, complete: true })
    expect(scopedAssertionForTarget({ receipt: receipt(metrics(window('mobile', 500), unavailable)), checkId: flag.checkId, flag })).toBeUndefined()
    repaired.assertions = repaired.assertions.filter(assertion => !assertion.context?.startsWith('loading:desktop:'))
    expect(scopedAssertionForTarget({ receipt: repaired, checkId: flag.checkId, flag })).toBeUndefined()
    const healthy = receipt(metrics(window('mobile', 500), window('desktop', 500)))
    const evidence = { auditId: 'after', executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: pageUrl,
      environment: 'production', checks: { [flag.checkId]: 1 }, outcomes: [], verificationTarget: null }, flag: { ...flag, pageUrl },
      executions: [{ targetKey: 'module:interaction', status: 'COMPLETED', detail: healthy }] }
    expect(hasRecordedRecoveryEvidence(evidence)).toBe(true)
    expect(hasRecordedRecoveryEvidence({ ...evidence, executions: [{ ...evidence.executions[0], detail: partial }] })).toBe(false)
  })
  it('keeps blank content, unavailable timing, changed access and redirects incomparable', () => {
    const flag = runInteractionChecks(metrics())[0]
    for (const change of ['blank', 'timing', 'access', 'redirect', 'profile'] as const) {
      const mobile = window('mobile', 500)
      if (change === 'blank') mobile.observation!.contentVisible = false
      if (change === 'timing') mobile.loadingClearedMs = null
      if (change === 'access') mobile.observation!.scope.access = 'credentialed:changed'
      if (change === 'redirect') mobile.observation!.scope.finalUrl = pageUrl + 'other'
      if (change === 'profile') mobile.observation!.scope.profile = 'different'
      expect(scopedAssertionForTarget({ receipt: receipt(metrics(mobile, window('desktop', 500))), checkId: flag.checkId, flag })).toBeUndefined()
    }
  })
  it('does not report a completed clearance when the mobile loader returns before capture', () => {
    const reappeared = { ...window('mobile', 5200), loadingVisibleAtFinal: true }
    const data = metrics(reappeared, window('desktop', 500))
    const original = runMobileUXQualityChecks(metrics()).find(flag => flag.checkId === 'mobile-load-delay-content')!
    expect(runInteractionChecks(data).map(flag => flag.checkId)).toEqual(['loading-indicator-stuck'])
    expect(runMobileUXQualityChecks(data).some(flag => flag.checkId === original.checkId)).toBe(false)
    const observed = receipt(data, 'mobile-ux-quality')
    expect(observed.assertions.find(assertion => assertion.key === 'mobile-loading-delay'))
      .toMatchObject({ passed: false, complete: false })
    expect(scopedAssertionForTarget({ receipt: observed, checkId: original.checkId, flag: original })).toBeUndefined()
  })
  it('withholds both findings and repair proof from interrupted loading samples', () => {
    const original = runInteractionChecks(metrics())[0]
    for (const elapsed of [500, 5200, null]) {
      const mobile = window('mobile', elapsed), desktop = window('desktop', elapsed)
      mobile.observation!.interrupted = true
      desktop.observation!.interrupted = true
      const data = metrics(mobile, desktop)
      expect(runInteractionChecks(data)).toEqual([])
      expect(runMobileUXQualityChecks(data).some(flag => flag.checkId === 'mobile-load-delay-content')).toBe(false)
      const observed = receipt(data)
      expect(observed.assertions.filter(assertion => assertion.key !== 'reduced-motion')).toEqual([
        expect.objectContaining({ key: 'blocking-loading-ui', passed: false, complete: false }),
        expect.objectContaining({ key: 'loading-delay', passed: false, complete: false }),
        expect.objectContaining({ key: 'loading-delay', passed: false, complete: false }),
      ])
      expect(scopedAssertionForTarget({ receipt: observed, checkId: original.checkId, flag: original })).toBeUndefined()
    }
  })
  it('verifies a stuck mobile loader and the separate mobile delay threshold', () => {
    const stuck = runInteractionChecks(metrics(window('mobile', null), window('desktop', 500)))[0]
    const healthy = metrics(window('mobile', 500), window('desktop', 500))
    expect(scopedAssertionForTarget({ receipt: receipt(healthy), checkId: stuck.checkId, flag: stuck })?.assertion.passed).toBe(true)
    const mobile = runMobileUXQualityChecks(metrics())
      .find(flag => flag.checkId === 'mobile-load-delay-content')!
    const cleared = receipt(healthy, 'mobile-ux-quality')
    expect(cleared.assertions.find(assertion => assertion.key === 'mobile-loading-delay')).toMatchObject({ passed: true, complete: true, disposition: 'observed' })
    expect(scopedAssertionForTarget({ receipt: cleared, checkId: mobile.checkId, flag: mobile })).toBeUndefined()
    expect(hasRecordedRecoveryEvidence({ auditId: 'after', executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: pageUrl,
      environment: 'production', checks: { [mobile.checkId]: 2 }, outcomes: [], verificationTarget: null }, flag: { ...mobile, pageUrl },
      executions: [{ targetKey: 'module:mobile-ux-quality', status: 'COMPLETED', detail: cleared }] })).toBe(false)
    const legacy = { ...mobile, verificationRule: undefined, evidenceTargets: undefined }
    expect(scopedAssertionForTarget({ receipt: receipt(healthy, 'mobile-ux-quality'), checkId: legacy.checkId, flag: legacy })).toBeUndefined()
  })
  it('records a targeted mobile loading clearance as an observation and still flags a slow window', async () => {
    const evaluate = evaluatorHandlers.find(handler => handler.kind === 'check')!.evaluate
    const spec = { version: 1, engine: 'progressive-v1', scope: 'DIAGNOSTIC', targetUrl: pageUrl, environment: 'production',
      checks: { 'mobile-load-delay-content': 2 }, outcomes: [], verificationTarget: { kind: 'DIAGNOSTIC', pageUrl, checkId: 'mobile-load-delay-content',
        attemptId: 'attempt', parentAuditId: 'before' } }
    const context = (mobile: PageLoadExperience) => ({ audit: { id: 'after', executionSpec: spec }, task: { id: 'task' },
      input: { pageUrl, position: 0, primary: true, role: 'primary', module: 'mobile-ux-quality' }, deadline: Date.now() + 10_000,
      dependencies: new Map([['browser', { workKind: 'browser', workState: 'COMPLETED', workResult: serializeArtifact('browser', {
        pageId: 'page', metadata: null, snapshot: { desktopUrl: null, mobileUrl: null, desktopHtml: null, desktopBase64: null, mobileBase64: null,
          consoleErrors: [], captureStatus: { desktop: 'failed', mobile: 'pending' }, captureFailures: [], captureMetrics: metrics(mobile) },
      }) }]]) }) as unknown as TaskContext
    const slow = checkArtifactSchema.parse(readArtifact(await evaluate(context(window('mobile', 5200))), 'check').data)
    const fast = checkArtifactSchema.parse(readArtifact(await evaluate(context(window('mobile', 500))), 'check').data)
    const returned = checkArtifactSchema.parse(readArtifact(await evaluate(context({ ...window('mobile', 5200), loadingVisibleAtFinal: true })), 'check').data)
    const flag = slow.flags.find(item => item.checkId === 'mobile-load-delay-content')
    expect(flag).toBeDefined()
    expect(slow.receipt.assertions.map(assertion => assertion.key)).toEqual(['mobile-loading-delay'])
    expect(fast.receipt.assertions.map(assertion => assertion.key)).toEqual(['mobile-loading-delay'])
    expect(slow.receipt.assertions.find(assertion => assertion.key === 'mobile-loading-delay')).toMatchObject({ passed: false, complete: true })
    expect(slow.receipt.assertions.find(assertion => assertion.key === 'mobile-loading-delay')?.disposition).toBeUndefined()
    expect(fast.flags).toEqual([])
    expect(returned.flags).toEqual([])
    expect(returned.receipt).toMatchObject({ complete: false, assertions: [{ key: 'mobile-loading-delay', passed: false, complete: false }] })
    expect(fast.receipt.assertions.find(assertion => assertion.key === 'mobile-loading-delay')).toMatchObject({ passed: true, complete: true, disposition: 'observed' })
    expect(scopedAssertionForTarget({ receipt: fast.receipt, checkId: flag!.checkId, flag: flag! })).toBeUndefined()
    expect(scopedAssertionForTarget({ receipt: slow.receipt, checkId: flag!.checkId, flag: flag! })?.assertion.passed).toBe(false)
    expect(hasRecordedRecoveryEvidence({ auditId: 'after', executionSpec: spec, flag: { ...flag!, pageUrl },
      executions: [{ targetKey: 'module:mobile-ux-quality', status: 'COMPLETED', detail: fast.receipt }] })).toBe(false)
  })
  it('does not turn scanner restrictions into loading failures or repair proof', () => {
    const data = metrics(window('mobile', null), window('desktop', 5200))
    data.loadExperience!.observation!.restricted = true; data.desktopLoadExperience!.observation!.restricted = true
    expect(runInteractionChecks(data)).toEqual([])
    const observed = receipt(data)
    expect(observed.assertions.filter(assertion => assertion.key !== 'reduced-motion')
      .every(assertion => !assertion.passed && assertion.complete === false && assertion.disposition !== 'observed')).toBe(true)
    expect(observed.complete).toBe(false)
  })
})
