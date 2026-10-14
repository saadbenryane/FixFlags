import { expect, it } from 'vitest'
import type { SiteFlagSeed } from '../coverage'
import { groupPerformanceFindings } from '../performance-groups'
it('keeps page and device scope separate and retains every Flag identity', () => {
  const flags = [
    { id: 'one', checkId: 'perf-lcp', pageUrl: 'https://example.com/' },
    { id: 'two', checkId: 'perf-unused-js', pageUrl: 'https://example.com/' },
    { id: 'three', checkId: 'perf-lcp', pageUrl: 'https://example.com/pricing' },
  ] as SiteFlagSeed[]
  const groups = groupPerformanceFindings(flags)
  expect(groups).toHaveLength(2)
  expect(groups[0].flags.map(flag => flag.id)).toEqual(['one', 'two'])
  expect(groups.flatMap(group => group.flags)).toEqual(flags)
})
