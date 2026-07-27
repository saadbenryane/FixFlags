import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Prisma, Plan } from '@prisma/client'

vi.mock('@/lib/db', () => ({
  prisma: {
    auditRunCost: {
      upsert: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    audit: {
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    creditPurchase: {
      findMany: vi.fn(),
    },
  },
}))

import {
  estimateLlmCostUsd,
  computeInfraOverheadUsd,
  persistAuditRunCost,
  formatUsd,
  sumEstimatedCost,
  sumEstimatedCostForDomain,
  decimalCost,
  sumEstimatedCostByPlan,
  sumRevenueByPlan,
  getCostOutliers,
} from '@/lib/billing/costs'
import { prisma } from '@/lib/db'

const mockUpsert = vi.mocked(prisma.auditRunCost.upsert)
const mockUpdate = vi.mocked(prisma.auditRunCost.update)
const mockFindUnique = vi.mocked(prisma.auditRunCost.findUnique)
const mockFindMany = vi.mocked(prisma.auditRunCost.findMany)
const mockAggregate = vi.mocked(prisma.auditRunCost.aggregate)
const mockGroupBy = vi.mocked(prisma.auditRunCost.groupBy)
const mockAuditFindMany = vi.mocked(prisma.audit.findMany)
const mockUserFindMany = vi.mocked(prisma.user.findMany)
const mockCreditFindMany = vi.mocked(prisma.creditPurchase.findMany)

beforeEach(() => {
  vi.stubEnv('LLM_COST_INPUT_PER_MTOK', '')
  vi.stubEnv('LLM_COST_OUTPUT_PER_MTOK', '')
  vi.stubEnv('COST_PAGESPEED_PER_CALL', '')
  vi.stubEnv('COST_BROWSER_PER_SECOND', '')
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('estimateLlmCostUsd', () => {
  describe('single model pricing', () => {
    it('calculates cost for gpt-4o-mini (input + output)', () => {
      const cost = estimateLlmCostUsd('gpt-4o-mini', 1_000_000, 1_000_000)
      expect(cost).toBeCloseTo(0.75, 10)
    })

    it('calculates cost for claude-sonnet-5', () => {
      const cost = estimateLlmCostUsd('claude-sonnet-5', 1_000_000, 1_000_000)
      expect(cost).toBeCloseTo(18, 10)
    })

    it('calculates cost for claude-haiku-4-5', () => {
      const cost = estimateLlmCostUsd('claude-haiku-4-5', 1_000_000, 1_000_000)
      expect(cost).toBeCloseTo(6, 10)
    })

    it('calculates cost for claude-opus-4-8', () => {
      const cost = estimateLlmCostUsd('claude-opus-4-8', 1_000_000, 1_000_000)
      expect(cost).toBeCloseTo(30, 10)
    })

    it('calculates cost for legacy claude-sonnet-4-20250514', () => {
      const cost = estimateLlmCostUsd('claude-sonnet-4-20250514', 1_000_000, 1_000_000)
      expect(cost).toBeCloseTo(18, 10)
    })

    it('calculates cost for legacy claude-3-5-haiku-20241022', () => {
      const cost = estimateLlmCostUsd('claude-3-5-haiku-20241022', 1_000_000, 1_000_000)
      expect(cost).toBeCloseTo(4.8, 10)
    })
  })

  describe('cache-read vs cache-write pricing', () => {
    it('charges 0.1x input rate for Claude cache reads', () => {
      const cost = estimateLlmCostUsd('claude-sonnet-5', 0, 0, 1_000_000)
      expect(cost).toBeCloseTo(0.3, 10)
    })

    it('charges 0.5x input rate for OpenAI cache reads', () => {
      const cost = estimateLlmCostUsd('gpt-4o-mini', 0, 0, 1_000_000)
      expect(cost).toBeCloseTo(0.075, 10)
    })

    it('charges 1.25x input rate for Claude cache writes', () => {
      const cost = estimateLlmCostUsd('claude-sonnet-5', 0, 0, 0, 1_000_000)
      expect(cost).toBeCloseTo(3.75, 10)
    })

    it('charges nothing for OpenAI cache writes', () => {
      const cost = estimateLlmCostUsd('gpt-4o-mini', 0, 0, 0, 1_000_000)
      expect(cost).toBeCloseTo(0, 10)
    })

    it('combines input, output, cache-read, and cache-write for Claude', () => {
      const cost = estimateLlmCostUsd(
        'claude-haiku-4-5',
        500_000,
        200_000,
        300_000,
        100_000
      )
      const inputCost = 0.5 * 1
      const outputCost = 0.2 * 5
      const cacheReadCost = 0.3 * 1 * 0.1
      const cacheWriteCost = 0.1 * 1 * 1.25
      expect(cost).toBeCloseTo(inputCost + outputCost + cacheReadCost + cacheWriteCost, 10)
    })
  })

  describe('input vs output token pricing', () => {
    it('charges input-only when output is zero', () => {
      const cost = estimateLlmCostUsd('gpt-4o-mini', 1_000_000, 0)
      expect(cost).toBeCloseTo(0.15, 10)
    })

    it('charges output-only when input is zero', () => {
      const cost = estimateLlmCostUsd('gpt-4o-mini', 0, 1_000_000)
      expect(cost).toBeCloseTo(0.6, 10)
    })

    it('output is priced at a higher rate than input for all models', () => {
      for (const model of ['gpt-4o-mini', 'claude-sonnet-5', 'claude-haiku-4-5']) {
        const inputOnly = estimateLlmCostUsd(model, 1_000_000, 0)
        const outputOnly = estimateLlmCostUsd(model, 0, 1_000_000)
        expect(outputOnly).toBeGreaterThan(inputOnly)
      }
    })
  })

  describe('multi-model comma-separated', () => {
    it('splits tokens evenly across two models', () => {
      const cost = estimateLlmCostUsd(
        'gpt-4o-mini, claude-sonnet-5',
        2_000_000,
        2_000_000
      )
      const single = estimateLlmCostUsd('gpt-4o-mini', 1_000_000, 1_000_000) +
        estimateLlmCostUsd('claude-sonnet-5', 1_000_000, 1_000_000)
      expect(cost).toBeCloseTo(single, 10)
    })

    it('splits cache tokens evenly across models', () => {
      const cost = estimateLlmCostUsd(
        'gpt-4o-mini, claude-sonnet-5',
        0,
        0,
        2_000_000,
        2_000_000
      )
      const expected =
        estimateLlmCostUsd('gpt-4o-mini', 0, 0, 1_000_000, 1_000_000) +
        estimateLlmCostUsd('claude-sonnet-5', 0, 0, 1_000_000, 1_000_000)
      expect(cost).toBeCloseTo(expected, 10)
    })

    it('handles three models', () => {
      const cost = estimateLlmCostUsd(
        'gpt-4o-mini, claude-sonnet-5, claude-haiku-4-5',
        3_000_000,
        0
      )
      const expected =
        estimateLlmCostUsd('gpt-4o-mini', 1_000_000, 0) +
        estimateLlmCostUsd('claude-sonnet-5', 1_000_000, 0) +
        estimateLlmCostUsd('claude-haiku-4-5', 1_000_000, 0)
      expect(cost).toBeCloseTo(expected, 10)
    })
  })

  describe('edge cases', () => {
    it('returns 0 for zero tokens', () => {
      expect(estimateLlmCostUsd('gpt-4o-mini', 0, 0)).toBe(0)
    })

    it('falls back to default rate for unknown model', () => {
      const cost = estimateLlmCostUsd('unknown-model-x', 1_000_000, 1_000_000)
      expect(cost).toBeCloseTo(18, 10)
    })

    it('env override replaces input rate', () => {
      vi.stubEnv('LLM_COST_INPUT_PER_MTOK', '10')
      const cost = estimateLlmCostUsd('gpt-4o-mini', 1_000_000, 0)
      expect(cost).toBeCloseTo(10, 10)
    })

    it('env override replaces output rate', () => {
      vi.stubEnv('LLM_COST_OUTPUT_PER_MTOK', '20')
      const cost = estimateLlmCostUsd('gpt-4o-mini', 0, 1_000_000)
      expect(cost).toBeCloseTo(20, 10)
    })

    it('handles fractional tokens', () => {
      const cost = estimateLlmCostUsd('gpt-4o-mini', 100, 100)
      expect(cost).toBeGreaterThan(0)
      expect(cost).toBeLessThan(0.01)
    })

    it('handles very large token counts', () => {
      const cost = estimateLlmCostUsd('claude-sonnet-5', 10_000_000, 10_000_000)
      expect(cost).toBeCloseTo(180, 10)
    })
  })
})

describe('computeInfraOverheadUsd', () => {
  it('returns 0 for zero inputs', () => {
    expect(computeInfraOverheadUsd(0, 0)).toBe(0)
  })

  it('charges per pagespeed call', () => {
    expect(computeInfraOverheadUsd(1, 0)).toBeCloseTo(0.005, 10)
    expect(computeInfraOverheadUsd(10, 0)).toBeCloseTo(0.05, 10)
  })

  it('charges per second of duration at default 0.0001/s', () => {
    expect(computeInfraOverheadUsd(0, 10_000)).toBeCloseTo(0.001, 6)
    expect(computeInfraOverheadUsd(0, 60_000)).toBeCloseTo(0.006, 6)
  })

  it('combines pagespeed and browser costs', () => {
    const cost = computeInfraOverheadUsd(3, 15_000)
    expect(cost).toBeCloseTo(3 * 0.005 + 15 * 0.0001, 6)
  })
})

describe('formatUsd', () => {
  it('formats values >= 0.01 with 2 decimals', () => {
    expect(formatUsd(12.5)).toBe('$12.50')
    expect(formatUsd(0.1)).toBe('$0.10')
    expect(formatUsd(100)).toBe('$100.00')
  })

  it('formats values < 0.01 with 4 decimals', () => {
    expect(formatUsd(0.001)).toBe('$0.0010')
    expect(formatUsd(0.000123)).toBe('$0.0001')
    expect(formatUsd(0)).toBe('$0.0000')
  })

  it('accepts Prisma.Decimal', () => {
    expect(formatUsd(new Prisma.Decimal(12.5))).toBe('$12.50')
    expect(formatUsd(new Prisma.Decimal(0.001))).toBe('$0.0010')
  })
})

describe('decimalCost', () => {
  it('returns a Prisma.Decimal', () => {
    const d = decimalCost(1.23)
    expect(d).toBeInstanceOf(Prisma.Decimal)
    expect(d.toNumber()).toBe(1.23)
  })
})

describe('persistAuditRunCost', () => {
  const baseMetrics = {
    durationMs: 5000,
    llmInputTokens: 1000,
    llmOutputTokens: 500,
    llmModel: 'gpt-4o-mini',
    pagespeedCalls: 2,
  }

  describe('full phase (default)', () => {
    it('upserts with computed LLM and infra costs', async () => {
      mockUpsert.mockResolvedValue({} as never)
      await persistAuditRunCost('audit-1', baseMetrics)
      expect(mockUpsert).toHaveBeenCalledTimes(1)
      const args = mockUpsert.mock.calls[0][0]
      expect(args.where.auditId).toBe('audit-1')
      expect(args.create.llmModel).toBe('gpt-4o-mini')
    })
  })

  describe('triage phase', () => {
    it('upserts with triage-specific fields', async () => {
      mockUpsert.mockResolvedValue({} as never)
      await persistAuditRunCost('audit-2', {
        ...baseMetrics,
        phase: 'triage',
      })
      expect(mockUpsert).toHaveBeenCalledTimes(1)
      const args = mockUpsert.mock.calls[0][0]
      expect(args.create.triageInputTokens).toBe(1000)
      expect(args.create.triageOutputTokens).toBe(500)
      expect(args.create.triageModel).toBe('gpt-4o-mini')
    })
  })

  describe('prescription phase', () => {
    it('accumulates tokens and costs from existing triage record', async () => {
      const existing = {
        triageInputTokens: 800,
        triageOutputTokens: 200,
        triageCostUsd: new Prisma.Decimal(0.001),
        triageModel: 'gpt-4o-mini',
        durationMs: 3000,
        pagespeedCalls: 1,
      }
      mockFindUnique.mockResolvedValue(existing as never)
      mockUpdate.mockResolvedValue({} as never)

      await persistAuditRunCost('audit-3', {
        ...baseMetrics,
        phase: 'prescription',
      })

      expect(mockUpdate).toHaveBeenCalledTimes(1)
      const data = mockUpdate.mock.calls[0][0].data
      expect(data.llmInputTokens).toBe(1800)
      expect(data.llmOutputTokens).toBe(700)
      expect(data.prescriptionInputTokens).toBe(1000)
      expect(data.prescriptionOutputTokens).toBe(500)
      expect(data.durationMs).toBe(5000)
      expect(data.pagespeedCalls).toBe(2)
    })

    it('does nothing when no existing record found', async () => {
      mockFindUnique.mockResolvedValue(null)
      await persistAuditRunCost('audit-4', {
        ...baseMetrics,
        phase: 'prescription',
      })
      expect(mockUpdate).not.toHaveBeenCalled()
    })
  })
})

describe('sumEstimatedCost', () => {
  it('returns sum from aggregate', async () => {
    mockAggregate.mockResolvedValue({
      _sum: { estimatedCostUsd: new Prisma.Decimal(42.5) },
    } as never)
    const total = await sumEstimatedCost()
    expect(total).toBeCloseTo(42.5, 10)
  })

  it('returns 0 when no rows exist', async () => {
    mockAggregate.mockResolvedValue({ _sum: { estimatedCostUsd: null } } as never)
    expect(await sumEstimatedCost()).toBe(0)
  })

  it('passes where filter through', async () => {
    mockAggregate.mockResolvedValue({
      _sum: { estimatedCostUsd: new Prisma.Decimal(10) },
    } as never)
    await sumEstimatedCost({ audit: { status: 'COMPLETED' } })
    expect(mockAggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { audit: { status: 'COMPLETED' } } })
    )
  })
})

describe('sumEstimatedCostForDomain', () => {
  it('returns sum for matching completed audits', async () => {
    mockAggregate.mockResolvedValue({
      _sum: { estimatedCostUsd: new Prisma.Decimal(7.5) },
    } as never)
    const total = await sumEstimatedCostForDomain('example.com')
    expect(total).toBeCloseTo(7.5, 10)
    const where = mockAggregate.mock.calls[0][0].where
    expect(where.audit.status).toBe('COMPLETED')
  })

  it('returns 0 when no matching audits', async () => {
    mockAggregate.mockResolvedValue({ _sum: { estimatedCostUsd: null } } as never)
    expect(await sumEstimatedCostForDomain('missing.com')).toBe(0)
  })
})

describe('sumEstimatedCostByPlan', () => {
  it('returns zeroed map when no costs', async () => {
    mockGroupBy.mockResolvedValue([] as never)
    const result = await sumEstimatedCostByPlan(new Date())
    expect(result).toEqual({ FREE: 0, BUILDER: 0, TEAM: 0 })
  })

  it('aggregates costs by user plan', async () => {
    mockGroupBy.mockResolvedValue([
      { auditId: 'a1', _sum: { estimatedCostUsd: new Prisma.Decimal(10) } },
      { auditId: 'a2', _sum: { estimatedCostUsd: new Prisma.Decimal(20) } },
    ] as never)
    mockAuditFindMany.mockResolvedValue([
      { id: 'a1', userId: 'u1' },
      { id: 'a2', userId: 'u2' },
    ] as never)
    mockUserFindMany.mockResolvedValue([
      { id: 'u1', plan: 'BUILDER' as Plan },
      { id: 'u2', plan: 'TEAM' as Plan },
    ] as never)

    const result = await sumEstimatedCostByPlan(new Date())
    expect(result.BUILDER).toBeCloseTo(10, 10)
    expect(result.TEAM).toBeCloseTo(20, 10)
    expect(result.FREE).toBe(0)
  })
})

describe('sumRevenueByPlan', () => {
  it('returns zeroed result when no users', async () => {
    mockUserFindMany.mockResolvedValueOnce([] as never)
    mockCreditFindMany.mockResolvedValue([] as never)
    mockUserFindMany.mockResolvedValueOnce([] as never)

    const result = await sumRevenueByPlan(new Date())
    expect(result.FREE).toEqual({ subscriptions: 0, creditPacks: 0, total: 0 })
    expect(result.BUILDER).toEqual({ subscriptions: 0, creditPacks: 0, total: 0 })
    expect(result.TEAM).toEqual({ subscriptions: 0, creditPacks: 0, total: 0 })
  })

  it('sums subscription revenue by plan', async () => {
    mockUserFindMany
      .mockResolvedValueOnce([
        { plan: 'BUILDER' },
        { plan: 'BUILDER' },
        { plan: 'TEAM' },
      ] as never)
    mockCreditFindMany.mockResolvedValue([] as never)
    mockUserFindMany.mockResolvedValueOnce([] as never)

    const result = await sumRevenueByPlan(new Date())
    expect(result.BUILDER.subscriptions).toBe(78)
    expect(result.TEAM.subscriptions).toBe(129)
    expect(result.FREE.subscriptions).toBe(0)
  })

  it('includes credit pack revenue when user also has subscription', async () => {
    mockUserFindMany.mockResolvedValueOnce([
      { plan: 'BUILDER' },
    ] as never)
    mockCreditFindMany.mockResolvedValue([
      { userId: 'u1', priceUsdCents: 500 },
    ] as never)
    mockUserFindMany.mockResolvedValueOnce([
      { id: 'u1', plan: 'BUILDER' as Plan },
    ] as never)

    const result = await sumRevenueByPlan(new Date())
    expect(result.BUILDER.creditPacks).toBeCloseTo(5, 10)
    expect(result.BUILDER.total).toBeCloseTo(39 + 5, 10)
  })
})

describe('getCostOutliers', () => {
  it('returns mapped outliers from recent runs', async () => {
    mockFindMany.mockResolvedValue([
      {
        auditId: 'a1',
        llmModel: 'claude-sonnet-5',
        estimatedCostUsd: new Prisma.Decimal(12.34),
        llmInputTokens: 5000,
        llmOutputTokens: 1000,
        audit: { url: 'https://example.com', normalizedDomain: 'example.com' },
      },
    ] as never)

    const outliers = await getCostOutliers(7)
    expect(outliers).toHaveLength(1)
    expect(outliers[0].auditId).toBe('a1')
    expect(outliers[0].domain).toBe('example.com')
    expect(outliers[0].model).toBe('claude-sonnet-5')
    expect(outliers[0].estimatedCostUsd).toBeCloseTo(12.34, 10)
  })

  it('falls back to url when normalizedDomain is null', async () => {
    mockFindMany.mockResolvedValue([
      {
        auditId: 'a2',
        llmModel: null,
        estimatedCostUsd: new Prisma.Decimal(1),
        llmInputTokens: 100,
        llmOutputTokens: 50,
        audit: { url: 'https://fallback.com', normalizedDomain: null },
      },
    ] as never)

    const outliers = await getCostOutliers()
    expect(outliers[0].domain).toBe('https://fallback.com')
    expect(outliers[0].model).toBeNull()
  })

  it('returns empty array when no runs found', async () => {
    mockFindMany.mockResolvedValue([] as never)
    expect(await getCostOutliers(30)).toEqual([])
  })
})
