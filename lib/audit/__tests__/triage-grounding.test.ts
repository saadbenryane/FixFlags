import { describe, expect, it } from 'vitest'
import { assessTriageRecommendations, deduplicateTriageRecommendations } from '../triage-grounding'
import type { TriageOutput } from '../judge-triage-schema'
import type { DeterministicFlag } from '../flag-types'

type Candidate = TriageOutput['newFlags'][number]
const facts = { pageText: 'A workspace for release planning.', metadata: { title: 'Release planning', description: 'Coordinate your team',
  h1s: ['Plan releases together'], ctaTexts: ['Start free', 'See an example', 'Contact us'], hasStructuredData: false }, screenshotHint: 'desktop-only' as const }
const candidate = (changes: Partial<Candidate> = {}): Candidate => ({ rubric: 'EXPERIENCE', impactTag: 'CONVERSION', severity: 'IMPORTANT',
  confidence: 0.9, pageUrl: 'https://example.com/', problem: 'No actionable CTAs visible',
  evidence: 'All actions are missing and users cannot proceed.', whyItMatters: 'Visitors abandon the page, reducing conversion rates.',
  reviewKind: 'action-clarity', evidenceRefs: [{ source: 'ctaText', quote: 'Start free' }], device: 'none', ...changes })

describe('page triage source grounding', () => {
  it('does not admit the actual unreferenced absence, decision-fatigue and abandonment claims', () => {
    const candidates = ['No actionable CTAs visible', 'Confusing competing CTAs above the fold', 'Missing mobile-friendly CTA placement']
      .map(problem => candidate({ problem, reviewKind: undefined, evidenceRefs: undefined, device: undefined }))
    const before = structuredClone(candidates)
    const result = assessTriageRecommendations(candidates, facts)
    expect(result.admitted).toEqual([])
    expect(result.assessment).toMatchObject({ status: 'PARTIAL', admittedCount: 0, rejected: [{ index: 0 }, { index: 1 }, { index: 2 }] })
    expect(result.assessment.candidates).toEqual(before)
    expect(candidates).toEqual(before)
  })
  it('a valid action quote anchors only a conditional review, never the unrelated raw claim', () => {
    const raw = candidate()
    const result = assessTriageRecommendations([raw], facts)
    expect(result.admitted[0]!.problem).toMatch(/^Review/)
    expect(result.admitted[0]!.evidence).toBe('Action wording: "Start free"')
    expect(result.admitted[0]!.whyItMatters).toContain('were not measured')
    expect(result.admitted[0]!.problem).not.toMatch(/missing|No actionable/)
    expect(result.assessment.candidates[0]).toEqual(raw)
  })
  it.each(['desktop', 'mobile'] as const)('text references cannot claim %s evidence from a device label', device => {
    expect(assessTriageRecommendations([candidate({ device })], facts).assessment.status).toBe('PARTIAL')
  })
  it('rejects a quote copied from a different source and an invented extension of a real label', () => {
    const result = assessTriageRecommendations([
      candidate({ evidenceRefs: [{ source: 'headline', quote: 'Start free' }] }),
      candidate({ evidenceRefs: [{ source: 'ctaText', quote: 'Start free without payment' }] }),
    ], facts)
    expect(result.admitted).toEqual([])
    expect(result.assessment.rejected).toHaveLength(2)
  })
  it.each([
    ['no-screenshot', 'desktop', false], ['desktop-only', 'desktop', true], ['desktop-only', 'mobile', false],
    ['mobile-only', 'mobile', true], ['mobile-only', 'desktop', false], ['desktop-and-mobile', 'mobile', true],
  ] as const)('requires the actual declared visual device for %s / %s', (screenshotHint, device, admitted) => {
    const review = candidate({ reviewKind: 'visual-hierarchy', device,
      evidenceRefs: [{ source: 'ctaText', quote: 'Start free' }, { source: 'ctaText', quote: 'See an example' }] })
    expect(assessTriageRecommendations([review], { ...facts, screenshotHint }).admitted.length).toBe(admitted ? 1 : 0)
  })
  it('a hierarchy review needs distinct recorded actions, not a repeated quote or prose', () => {
    const repeated = [{ source: 'ctaText' as const, quote: 'Start free' }, { source: 'ctaText' as const, quote: 'Start free' }]
    expect(assessTriageRecommendations([candidate({ reviewKind: 'visual-hierarchy', device: 'desktop', evidenceRefs: repeated })], facts).admitted).toEqual([])
  })
  it('does not invent two actions from fragments of a single control', () => {
    const oneAction = { ...facts, metadata: { ...facts.metadata, ctaTexts: ['Equipment pricing'] } }
    const review = candidate({ reviewKind: 'visual-hierarchy', device: 'desktop', evidenceRefs: [
      { source: 'ctaText', quote: 'Equipment' }, { source: 'ctaText', quote: 'pricing' },
    ] })
    expect(assessTriageRecommendations([review], oneAction).admitted).toEqual([])
  })
  it('does not suppress a distinct recorded H1 merely because another headline has a native advisory', () => {
    const twoHeadings = { ...facts, metadata: { ...facts.metadata, h1s: ['Hi', 'Plan releases together'] } }
    const review = candidate({ reviewKind: 'copy-clarity', rubric: 'MESSAGE', evidenceRefs: [{ source: 'headline', quote: 'Plan releases together' }] })
    const native = { checkId: 'messaging-headline-too-short', pageUrl: 'https://example.com/', problem: 'Short opening H1',
      evidence: 'Recorded first H1: "Hi"', rubric: 'MESSAGE', severity: 'POLISH', fix: 'Review Hi', source: 'DETERMINISTIC', confidence: 0.9 } as DeterministicFlag
    expect(deduplicateTriageRecommendations(assessTriageRecommendations([review], twoHeadings).admitted, [native], review.pageUrl!)).toHaveLength(1)
  })
  it('groups only the same declared scope and retains unrelated native mechanisms, pages and visual devices', () => {
    const review = candidate({ reviewKind: 'copy-clarity', rubric: 'MESSAGE', evidenceRefs: [{ source: 'headline', quote: 'Plan releases together' }] })
    const grounded = assessTriageRecommendations([review], facts).admitted
    const native = { checkId: 'messaging-no-audience', pageUrl: 'https://example.com/', evidence: 'Recorded headline: Plan releases together',
      problem: 'Same wording is not identity', rubric: 'MESSAGE', severity: 'POLISH', fix: 'Review audience context', source: 'DETERMINISTIC', confidence: 0.8 } as DeterministicFlag
    expect(deduplicateTriageRecommendations(grounded, [native], review.pageUrl!)).toEqual([])
    expect(deduplicateTriageRecommendations(grounded, [{ ...native, pageUrl: 'https://example.com/pricing' }], review.pageUrl!)).toHaveLength(1)
    expect(deduplicateTriageRecommendations(grounded, [{ ...native, checkId: 'broken-internal-links' }], review.pageUrl!)).toHaveLength(1)
    const visual = { ...candidate(), reviewKind: 'visual-hierarchy' as const, device: 'desktop' as const,
      evidenceRefs: [{ source: 'ctaText' as const, quote: 'Start free' }, { source: 'ctaText' as const, quote: 'See an example' }] }
    const visuals = assessTriageRecommendations([visual], facts).admitted
    expect(deduplicateTriageRecommendations(visuals, [{ ...native, checkId: 'hierarchy-competing-actions', evidence: 'Start free, See an example' }], visual.pageUrl!)).toHaveLength(1)
  })
})
