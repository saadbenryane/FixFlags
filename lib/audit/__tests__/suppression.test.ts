import { expect, it } from 'vitest'
import { suppressOverlappingFlags } from '../suppression'
import type { DeterministicFlag } from '../flag-types'

const scopedFlag = (checkId: string, pageUrl?: string, affectedPaths?: string[]): DeterministicFlag => ({
  checkId, pageUrl, affectedPaths, rubric: 'EXPERIENCE', severity: 'IMPORTANT', problem: checkId,
  evidence: 'Observed on the captured page', fix: 'Repair the affected page', confidence: 1, source: 'DETERMINISTIC',
})

it('keeps one actionable missing-H1 finding and retains unrelated metadata evidence', () => {
  const flag = (checkId: string): DeterministicFlag => ({ checkId, rubric: 'SEO', severity: 'IMPORTANT', problem: 'Missing heading', evidence: 'No H1', fix: 'Use a heading', confidence: 1, source: 'DETERMINISTIC' })
  expect(suppressOverlappingFlags([flag('hierarchy-no-headline'), flag('h1-missing'), flag('description-missing')]).map(item => item.checkId)).toEqual(['h1-missing', 'description-missing'])
  expect(suppressOverlappingFlags([flag('hierarchy-no-headline')])).toHaveLength(1)
})

it('keeps distinct page failures while suppressing duplicate symptoms on the same page', () => {
  const root = 'https://example.com/'
  const pricing = 'https://example.com/pricing'
  const flags = [scopedFlag('hierarchy-no-headline', root), scopedFlag('h1-missing', root),
    scopedFlag('hierarchy-no-headline', pricing)]
  expect(suppressOverlappingFlags(flags)).toEqual([flags[1], flags[2]])
})

it('does not let consolidated security findings on one page hide another page hardening failure', () => {
  const root = 'https://example.com/'
  const signup = 'https://example.com/signup'
  const flags = [scopedFlag('security-headers-missing', root), scopedFlag('security-hsts-too-short', root),
    scopedFlag('security-hsts-too-short', signup), scopedFlag('security-headers-hardening', root),
    scopedFlag('security-csp-unsafe-eval', signup), scopedFlag('security-csp-unsafe-eval', root)]
  expect(suppressOverlappingFlags(flags)).toEqual([flags[0], flags[2], flags[3], flags[4]])
})

it('keeps a collapsed multi-page issue until every affected page has a specific finding', () => {
  const root = 'https://example.com/'
  const pricing = 'https://example.com/pricing'
  const broad = scopedFlag('perf-score-poor', root, [root, pricing])
  const rootSpecific = scopedFlag('cls-critical', root)
  expect(suppressOverlappingFlags([broad, rootSpecific])).toEqual([broad, rootSpecific])
  expect(suppressOverlappingFlags([broad, rootSpecific, scopedFlag('cls-critical', pricing)]))
    .toEqual([rootSpecific, scopedFlag('cls-critical', pricing)])
})

it('keeps unknown page scopes separate from explicit observations', () => {
  const flags = [scopedFlag('perf-score-poor'), scopedFlag('cls-critical', 'https://example.com/')]
  expect(suppressOverlappingFlags(flags)).toEqual(flags)
})
