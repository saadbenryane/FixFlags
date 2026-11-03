import { describe, expect, it } from 'vitest'
import { browserCollectionRequirements, browserDevicesForCheck } from '../browser-requirements'
import { initialTaskPlan } from '../graph'
import { CHECK_REGISTRY } from '../../check-registry'

const consumer = (module: string) => ({ workKind: 'check', workInput: {
  pageUrl: 'https://example.com/', position: 0, primary: true, role: 'primary', module,
} })
describe('recorded browser evidence consumers', () => {
  it.each(['mobile-input-zoom', 'mobile-load-delay-content', 'motion-ignores-reduced-preference', 'loading-indicator-stuck'])(
    'collects only the independently scoped mobile evidence for %s', checkId => {
      const pageUrl = 'https://example.com/'
      const checks = { [checkId]: CHECK_REGISTRY[checkId].version }
      const checkModule = CHECK_REGISTRY[checkId].module
      expect(browserDevicesForCheck(checkModule, checks)).toEqual(['mobile'])
      const spec = { version: 1 as const, engine: 'progressive-v1' as const, browserCollection: 'per-profile-v1' as const,
        scope: 'DIAGNOSTIC' as const, targetUrl: pageUrl, environment: 'production', checks, outcomes: [],
        verificationTarget: { kind: 'DIAGNOSTIC' as const, pageUrl, checkId, parentAuditId: 'original', attemptId: 'repair' } }
      const graph = initialTaskPlan(spec)
      expect(graph.filter(task => task.kind === 'browser').map(task => task.input.device)).toEqual(['mobile'])
      expect(graph.find(task => task.kind === 'check')!.dependencies).not.toContain('p0:browser')
      // Ordinary repair admission retains the complete detector registry in
      // its snapshot. The named target still owns the executable dependency.
      const admitted = initialTaskPlan({ ...spec, checks: Object.fromEntries(Object.entries(CHECK_REGISTRY).map(([id, check]) => [id, check.version])) })
      expect(admitted.filter(task => task.kind === 'browser').map(task => task.input.device)).toEqual(['mobile'])
      const historical = initialTaskPlan({ ...spec, browserCollection: undefined })
      expect(historical.filter(task => task.kind === 'browser').map(task => task.input.device)).toEqual([undefined])
    })
  it.each(['mobile-cta-thumb-zone', 'mobile-cta-weak-label', 'loading-state-slow', 'competing-ctas', 'visual-radius-inconsistent'])(
    'retains the admitted desktop comparison or page-purpose source for %s', checkId => {
      expect(browserDevicesForCheck(CHECK_REGISTRY[checkId].module, { [checkId]: CHECK_REGISTRY[checkId].version })).toEqual(['desktop', 'mobile'])
    })
  it.each(['metadata', 'measurement', 'seo', 'trust'])('keeps %s on desktop without unrelated axe or mobile collection', module => {
    expect(browserCollectionRequirements([consumer(module), { workKind: 'finalize', workInput: null }]))
      .toEqual({ collectMobile: false, collectAccessibility: false })
  })
  it('collects axe for accessibility and both devices for console and native mobile metrics', () => {
    expect(browserCollectionRequirements([consumer('accessibility')])).toEqual({ collectMobile: true, collectAccessibility: true })
    expect(browserCollectionRequirements([consumer('accessibility')], { 'buttons-no-text': 1 }))
      .toEqual({ collectMobile: false, collectAccessibility: true })
    expect(browserCollectionRequirements([consumer('accessibility')], { 'axe-target-size': 1 }))
      .toEqual({ collectMobile: true, collectAccessibility: true })
    for (const moduleId of ['mobile-ux-quality', 'interaction', 'layout'])
      expect(browserCollectionRequirements([consumer(moduleId)])).toEqual({ collectMobile: true, collectAccessibility: false })
    expect(browserCollectionRequirements([consumer('console')])).toEqual({ collectMobile: true, collectAccessibility: true })
    expect(browserCollectionRequirements([consumer('accessibility'), consumer('console')]))
      .toEqual({ collectMobile: true, collectAccessibility: true })
  })
  it('retains the original mobile motion window even when no check directly requests metrics', () => {
    expect(browserCollectionRequirements([{ workKind: 'motion', workInput: null }]))
      .toEqual({ collectMobile: true, collectAccessibility: false })
  })
  it.each([[], [{ workKind: 'unknown', workInput: null }], [consumer('unknown')], [{ workKind: 'check', workInput: {} }]].map(consumers => ({ consumers })))(
    'preserves complete collection for unknown or historical responsibilities: $consumers', ({ consumers }) => {
      expect(browserCollectionRequirements(consumers)).toEqual({ collectMobile: true, collectAccessibility: true })
    })
})
