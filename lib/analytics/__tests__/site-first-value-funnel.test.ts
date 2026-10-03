import { beforeEach, describe, expect, it, vi } from 'vitest'

const findLifecycleEvents = vi.hoisted(() => vi.fn())
const findAudits = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  prisma: {
    siteLifecycleEvent: { findMany: findLifecycleEvents },
    audit: { findMany: findAudits },
  },
}))

import {
  calculateSiteFirstValueFunnel,
  loadSiteFirstValueFunnel,
} from '../site-first-value-funnel'

describe('Site first-value funnel', () => {
  beforeEach(() => {
    findLifecycleEvents.mockReset()
    findAudits.mockReset()
  })

  it('keeps claimed anonymous starts in the immutable cohort', () => {
    const funnel = calculateSiteFirstValueFunnel({
      starts: [
        {
          idempotencyKey: 'analyze_started:a1',
          properties: { anonymous: true },
        },
        {
          idempotencyKey: 'analyze_started:a2',
          properties: { anonymous: true },
        },
        {
          idempotencyKey: 'analyze_started:a3',
          properties: { anonymous: true },
        },
        {
          idempotencyKey: 'analyze_started:signed-in',
          properties: { anonymous: false },
        },
      ],
      audits: [
        {
          id: 'a1',
          userId: null,
          status: 'COMPLETED',
          utmSource: 'search',
          source: 'HOMEPAGE',
        },
        {
          id: 'a2',
          userId: 'user-1',
          status: 'COMPLETED',
          utmSource: 'search',
          source: 'HOMEPAGE',
        },
        {
          id: 'a3',
          userId: null,
          status: 'FAILED',
          utmSource: null,
          source: 'TOOL_PAGE',
        },
      ],
      results: [
        { idempotencyKey: 'first_useful_result:a1' },
        { idempotencyKey: 'first_useful_result:a2' },
        { idempotencyKey: 'first_useful_result:not-in-cohort' },
      ],
    })

    expect(funnel).toEqual({
      started: 3,
      firstUsefulResult: 2,
      resultRate: 67,
      claimed: 1,
      claimRate: 33,
      failedBeforeResult: 1,
      stillRunning: 0,
      missingAudit: 0,
      sources: [
        { source: 'search', started: 2, firstUsefulResult: 2, claimed: 1 },
        { source: 'tool page', started: 1, firstUsefulResult: 0, claimed: 0 },
      ],
    })
  })

  it('deduplicates start identities and reports incomplete records honestly', () => {
    const funnel = calculateSiteFirstValueFunnel({
      starts: [
        {
          idempotencyKey: 'analyze_started:a1',
          properties: { anonymous: true },
        },
        {
          idempotencyKey: 'analyze_started:a1',
          properties: { anonymous: true },
        },
        { idempotencyKey: 'not-a-start:a2', properties: { anonymous: true } },
        {
          idempotencyKey: 'analyze_started:a3',
          properties: { anonymous: true },
        },
      ],
      audits: [
        {
          id: 'a1',
          userId: null,
          status: 'CHECKING',
          utmSource: null,
          source: 'UNKNOWN',
        },
      ],
      results: [],
    })

    expect(funnel.started).toBe(2)
    expect(funnel.stillRunning).toBe(1)
    expect(funnel.missingAudit).toBe(1)
    expect(funnel.sources).toEqual([
      { source: 'unknown', started: 1, firstUsefulResult: 0, claimed: 0 },
    ])
  })

  it('loads results by exact cohort identity without cutting them off at the start date', async () => {
    const since = new Date('2026-09-01T00:00:00.000Z')
    const starts = [
      { idempotencyKey: 'analyze_started:a1', properties: { anonymous: true } },
      {
        idempotencyKey: 'analyze_started:s1',
        properties: { anonymous: false },
      },
    ]
    findLifecycleEvents
      .mockResolvedValueOnce(starts)
      .mockResolvedValueOnce([{ idempotencyKey: 'first_useful_result:a1' }])
    findAudits.mockResolvedValueOnce([
      {
        id: 'a1',
        userId: 'user-1',
        status: 'COMPLETED',
        utmSource: null,
        source: 'HOMEPAGE',
      },
    ])

    const funnel = await loadSiteFirstValueFunnel(since)

    expect(findLifecycleEvents).toHaveBeenNthCalledWith(1, {
      where: { name: 'analyze_started', createdAt: { gte: since } },
      select: { idempotencyKey: true, properties: true },
    })
    expect(findLifecycleEvents).toHaveBeenNthCalledWith(2, {
      where: {
        name: 'first_useful_result',
        idempotencyKey: { in: ['first_useful_result:a1'] },
      },
      select: { idempotencyKey: true },
    })
    expect(funnel).toMatchObject({
      started: 1,
      firstUsefulResult: 1,
      claimed: 1,
    })
  })
})
