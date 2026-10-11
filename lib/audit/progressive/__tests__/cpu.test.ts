import { expect, it } from 'vitest'
import { evaluateSearchIsolated } from '../cpu'
import { evidence } from '../../search/__tests__/fixtures'

it('passes evaluator selection through the real bounded parser worker', async () => {
  const observations = await evaluateSearchIsolated(evidence(), null, Date.now() + 10_000, ['crawl'])
  expect(observations.map(item => item.checkId)).toEqual(['search-http-access', 'search-crawl-access'])
  expect(observations.every(item => item.responsibility === 'crawl')).toBe(true)
}, 15_000)
