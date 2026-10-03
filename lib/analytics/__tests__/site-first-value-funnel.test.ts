import { beforeEach, describe, expect, it, vi } from 'vitest'

const findLifecycleEvents = vi.hoisted(() => vi.fn())
const findAudits = vi.hoisted(() => vi.fn())
const findGrowthArtifact = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  prisma: {
    siteLifecycleEvent: { findMany: findLifecycleEvents },
    audit: { findMany: findAudits },
    growthArtifact: { findUnique: findGrowthArtifact },
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
    findGrowthArtifact.mockReset().mockResolvedValue(null)
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
      landing: {
        status: 'missing',
        fetchedAt: null,
        startDate: null,
        endDate: null,
        landingSessions: null,
        startedSessions: null,
        firstUsefulResultSessions: null,
        claimedSessions: null,
        startRate: null,
        resultRate: null,
        claimRate: null,
        instrumentedStarts: 0,
        unattributedEventCount: 0,
        rowLimitReached: false,
      },
    })
  })

  it('joins unique consenting landing sessions to server result and claim truth', () => {
    const journeyOne = `ffj_${'1'.repeat(32)}`
    const journeyTwo = `ffj_${'2'.repeat(32)}`
    const journeyNoStart = `ffj_${'3'.repeat(32)}`
    const funnel = calculateSiteFirstValueFunnel({
      starts: [
        {
          idempotencyKey: 'analyze_started:a1',
          properties: { anonymous: true, journeyId: journeyOne },
        },
        {
          idempotencyKey: 'analyze_started:a2',
          properties: { anonymous: true, journeyId: journeyTwo },
        },
        {
          idempotencyKey: 'analyze_started:a3',
          properties: { anonymous: true, journeyId: journeyTwo },
        },
      ],
      audits: [
        { id: 'a1', userId: 'user-1', status: 'COMPLETED', utmSource: null, source: 'HOMEPAGE' },
        { id: 'a2', userId: null, status: 'COMPLETED', utmSource: null, source: 'HOMEPAGE' },
        { id: 'a3', userId: null, status: 'FAILED', utmSource: null, source: 'HOMEPAGE' },
      ],
      results: [
        { idempotencyKey: 'first_useful_result:a1' },
        { idempotencyKey: 'first_useful_result:a2' },
      ],
      landingArtifact: {
        status: 'available',
        fetchedAt: '2026-10-03T12:00:00.000Z',
        startDate: '2026-09-05',
        endDate: '2026-10-03',
        journeyIds: [journeyOne, journeyTwo, journeyNoStart],
        unattributedEventCount: 0,
        rowLimitReached: false,
      },
    })

    expect(funnel.landing).toEqual({
      status: 'available',
      fetchedAt: '2026-10-03T12:00:00.000Z',
      startDate: '2026-09-05',
      endDate: '2026-10-03',
      landingSessions: 3,
      startedSessions: 2,
      firstUsefulResultSessions: 2,
      claimedSessions: 1,
      startRate: 67,
      resultRate: 67,
      claimRate: 33,
      instrumentedStarts: 3,
      unattributedEventCount: 0,
      rowLimitReached: false,
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
    findGrowthArtifact.mockResolvedValueOnce({
      payload: {
        status: 'available',
        fetchedAt: '2026-10-03T12:00:00.000Z',
        startDate: '2026-09-05',
        endDate: '2026-10-03',
        journeys: [],
        unattributedEventCount: 0,
        rowLimitReached: false,
      },
    })
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
    expect(findGrowthArtifact).toHaveBeenCalledWith({
      where: { path: 'ga/rolling-28d/landing-journeys' },
      select: { payload: true },
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
