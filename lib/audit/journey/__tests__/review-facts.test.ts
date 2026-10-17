import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => { throw new Error('Fact assessment must not load the database') })
vi.mock('@/lib/audit/screenshot', () => { throw new Error('Fact assessment must not launch a browser') })
vi.mock('../planner', () => { throw new Error('Fact assessment must not call a planner') })
vi.mock('../evaluator', () => { throw new Error('Fact assessment must not call a provider') })
import { selectJourneyRuns } from '../review-scope'
import { prepareJourneyFindings } from '../review-findings'

const condition = (selector: string, phase: 'landing' | 'destination' = 'destination') => ({
  journeyType: 'signup' as const, phase, pageKey: 'a'.repeat(64), route: [{ selector, label: selector }],
})
describe('recorded journey scope and fact assessment', () => {
  it('keeps distinct original destination routes and suppresses their redundant landing scope', () => {
    const one = condition('#first'), two = condition('#second')
    expect(selectJourneyRuns(null, 'article', { expectedJourneyConditions: [condition('#landing', 'landing'), one, one, two] }))
      .toEqual([{ journeyType: 'signup', route: one.route }, { journeyType: 'signup', route: two.route }])
  })
  it('does not rediscover journeys when the recorded verification scope is empty', () => {
    expect(selectJourneyRuns(null, null, { expectedJourneyConditions: [] })).toEqual([])
  })
  it('retains a previously observed route even when page-purpose discovery would omit that journey', () => {
    const original = condition('#original')
    const runs = selectJourneyRuns(null, 'article', { recordedJourneyConditions: [original] })
    expect(runs[0]).toEqual({ journeyType: 'signup', route: original.route })
    expect(runs.filter(run => run.journeyType === 'signup')).toHaveLength(1)
    expect(runs.some(run => run.journeyType === 'first-visit')).toBe(true)
  })
  it('preserves repeated supporting observations before grouping without mutating collected facts', () => {
    const finding = Object.freeze({ checkId: 'journey-first-visit-hidden-cta', stepNumber: 1, url: 'https://example.test/',
      rubric: 'EXPERIENCE' as const, severity: 'IMPORTANT' as const, impactTag: 'CONVERSION' as const,
      problem: 'The original action is hidden', evidence: 'The recorded control is outside the first screen.',
      whyItMatters: 'The control is not visible in this condition.', fix: 'Make that control visible.' })
    const result = Object.freeze({ findings: Object.freeze([finding, finding]), steps: [], formProbe: null,
      startUrl: finding.url })
    const snapshot = structuredClone(result)
    const assessed = prepareJourneyFindings(result, ['journey-hidden-cta'])
    expect(assessed).toHaveLength(2)
    expect(assessed.every(item => item.evidence.startsWith('Reproduced at step 1.'))).toBe(true)
    expect(prepareJourneyFindings(result, ['title-missing'])).toEqual([])
    expect(result).toEqual(snapshot)
  })
})
