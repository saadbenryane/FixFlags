import { describe, expect, it } from 'vitest'
import { distribution, summarizeCheckCosts } from '../check-cost'

describe('check cost summary', () => {
  it('reports median and p90 over measured runs and counts unmeasured runs as missing', () => {
    expect(distribution([0.1, 0.3, null, 0.2, 1])).toEqual({ count: 5, missing: 1, medianUsd: 0.2, p90Usd: 1, totalUsd: 1.6 })
    expect(distribution([])).toEqual({ count: 0, missing: 0, medianUsd: null, p90Usd: null, totalUsd: 0 })
  })

  it('separates anonymous first checks from owned checks and totals each active Site', () => {
    const summary = summarizeCheckCosts([
      { userId: null, parentId: null, projectId: null, costUsd: 0.05 },
      { userId: null, parentId: null, projectId: 'p0', costUsd: 0.07 },
      { userId: 'u1', parentId: null, projectId: 'p1', costUsd: 0.2 },
      { userId: 'u1', parentId: 'a', projectId: 'p1', costUsd: 0.3 },
      { userId: 'u2', parentId: null, projectId: 'p2', costUsd: 0.4 },
      { userId: 'u2', parentId: 'b', projectId: 'p2', costUsd: null },
      { userId: 'u3', parentId: null, projectId: null, costUsd: 0.1 },
    ], 30)
    expect(summary.anonymousFirstCheck).toMatchObject({ count: 2, medianUsd: 0.05 })
    expect(summary.ownedCheck).toMatchObject({ count: 5, missing: 1 })
    expect(summary.perActiveSite).toMatchObject({ count: 2, missing: 1, medianUsd: 0.5 })
    expect(summary.windowDays).toBe(30)
  })
})
