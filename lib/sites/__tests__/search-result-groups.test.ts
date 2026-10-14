import { expect, it } from 'vitest'
import type { SiteCheckResult } from '../check-results'
import { groupRecordedSearchResults } from '../search-result-groups'
it('consolidates identical facts while preserving executions, source disagreements and historical identity', () => {
  const result = { auditId: 'analysis', historical: false, search: { observed: 'Useful title', source: 'http' }, evidenceReference: { executionId: 'one' } } as SiteCheckResult
  const results = [result, { ...result, evidenceReference: { ...result.evidenceReference, executionId: 'two' } },
    { ...result, historical: true }, { ...result, search: { ...result.search!, source: 'rendered-dom', observed: 'Different title' } }]
  const groups = groupRecordedSearchResults(results)
  expect(groups).toHaveLength(3)
  expect(groups[0].executions).toEqual(['one', 'two'])
  expect(groups[2].result.search?.observed).toBe('Different title')
})
