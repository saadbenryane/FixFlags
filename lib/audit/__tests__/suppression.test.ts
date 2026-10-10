import { expect, it } from 'vitest'
import { suppressOverlappingFlags } from '../suppression'
import type { DeterministicFlag } from '../flag-types'

it('keeps one actionable missing-H1 finding and retains unrelated metadata evidence', () => {
  const flag = (checkId: string): DeterministicFlag => ({ checkId, rubric: 'SEO', severity: 'IMPORTANT', problem: 'Missing heading', evidence: 'No H1', fix: 'Use a heading', confidence: 1, source: 'DETERMINISTIC' })
  expect(suppressOverlappingFlags([flag('hierarchy-no-headline'), flag('h1-missing'), flag('description-missing')]).map(item => item.checkId)).toEqual(['h1-missing', 'description-missing'])
  expect(suppressOverlappingFlags([flag('hierarchy-no-headline')])).toHaveLength(1)
})
