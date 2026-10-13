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
  parseLandingJourneyArtifact,
} from '../site-first-value-funnel'

describe('Site first-value funnel', () => {
  beforeEach(() => {
    findLifecycleEvents.mockReset()
    findAudits.mockReset()
    findGrowthArtifact.mockReset().mockResolvedValue(null)
  })

  it('keeps incomparable legacy exports out of conversion rates', () => {
    const legacy = parseLandingJourneyArtifact({
      status: 'available', fetchedAt: '2026-10-03T12:00:00Z',
      startDate: '2026-09-05', endDate: '2026-10-03', journeys: [],
    })
    const funnel = calculateSiteFirstValueFunnel({ starts: [], audits: [], results: [], landingArtifact: legacy })
    expect(funnel.landing).toMatchObject({ status: 'incomparable', landingSessions: null, startRate: null })
  })

  it('keeps an observed empty denominator distinct from a zero-percent conversion', () => {
    const artifact = parseLandingJourneyArtifact({
      status: 'available', fetchedAt: '2026-10-03T12:00:00Z',
      startDate: '2026-09-05', endDate: '2026-10-03', reportingTimeZone: 'UTC',
      journeys: [], unattributedEventCount: 0,
    })
    expect(calculateSiteFirstValueFunnel({ starts: [], audits: [], results: [], landingArtifact: artifact }).landing)
      .toMatchObject({ status: 'available', landingSessions: 0, startRate: null, resultRate: null, claimRate: null })
    expect(parseLandingJourneyArtifact({ ...artifact, journeys: [], unattributedEventCount: -1 })).toBeNull()
  })

  it('matches GA calendar dates in the reporting timezone and excludes starts after export', () => {
    const journeyId = `ffj_${'1'.repeat(32)}`
    const artifact = {
      status: 'available' as const, fetchedAt: '2026-10-03T12:00:00Z',
      startDate: '2026-09-05', endDate: '2026-10-03', reportingTimeZone: 'America/Los_Angeles',
      journeyIds: [journeyId], unattributedEventCount: 0, rowLimitReached: false,
    }
    const calculateAt = (createdAt: string) => calculateSiteFirstValueFunnel({
      starts: [{ idempotencyKey: 'analyze_started:a1', properties: { anonymous: true, journeyId }, createdAt: new Date(createdAt) }],
      audits: [], results: [], landingArtifact: artifact,
    }).landing
    expect(calculateAt('2026-09-05T06:59:59Z').startedSessions).toBe(0)
    expect(calculateAt('2026-09-05T07:00:00Z').startedSessions).toBe(1)
    expect(calculateAt('2026-10-03T12:00:01Z').startedSessions).toBe(0)
    for (const reportingTimeZone of ['unknown-zone', null]) {
      expect(calculateSiteFirstValueFunnel({ starts: [], audits: [], results: [], landingArtifact: { ...artifact, reportingTimeZone } }).landing.startRate).toBeNull()
    }
    expect(calculateSiteFirstValueFunnel({ starts: [], audits: [], results: [], landingArtifact: { ...artifact, startDate: '2026-02-30' } }).landing.startRate).toBeNull()
  })

  it('loads the complete GA start window independently of a shorter operational cohort', async () => {
    const journeyId = `ffj_${'1'.repeat(32)}`
    const since = new Date('2026-10-01T00:00:00Z')
    findGrowthArtifact.mockResolvedValue({ payload: {
      status: 'available', fetchedAt: '2026-10-03T12:00:00Z',
      startDate: '2026-09-05', endDate: '2026-10-03', reportingTimeZone: 'UTC',
      journeys: [{ journeyId, eventCount: 1 }], unattributedEventCount: 0, rowLimitReached: false,
    } })
    findLifecycleEvents.mockResolvedValueOnce([
      { idempotencyKey: 'analyze_started:a1', properties: { anonymous: true, journeyId }, createdAt: new Date('2026-09-20T00:00:00Z') },
    ]).mockResolvedValueOnce([{ idempotencyKey: 'first_useful_result:a1' }])
    findAudits.mockResolvedValue([{ id: 'a1', userId: 'owner', status: 'COMPLETED', utmSource: null, source: 'HOMEPAGE' }])
    const result = await loadSiteFirstValueFunnel(since)
    expect(findLifecycleEvents.mock.calls[0][0].where.createdAt.gte).toEqual(new Date('2026-09-04T00:00:00Z'))
    expect(result.started).toBe(0)
    expect(result.landing).toMatchObject({ startedSessions: 1, firstUsefulResultSessions: 1, claimedSessions: 1, startRate: 100 })
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
        providerLimited: false,
      },
    })
  })

  it('joins unique consenting landing journeys to server result and claim truth', () => {
    const journeyOne = `ffj_${'1'.repeat(32)}`
    const journeyTwo = `ffj_${'2'.repeat(32)}`
    const journeyNoStart = `ffj_${'3'.repeat(32)}`
    const funnel = calculateSiteFirstValueFunnel({
      starts: [
        {
          idempotencyKey: 'analyze_started:a1',
          properties: { anonymous: true, journeyId: journeyOne },
          createdAt: new Date('2026-09-20T12:00:00Z'),
        },
        {
          idempotencyKey: 'analyze_started:a2',
          properties: { anonymous: true, journeyId: journeyTwo },
          createdAt: new Date('2026-09-20T12:00:00Z'),
        },
        {
          idempotencyKey: 'analyze_started:a3',
          properties: { anonymous: true, journeyId: journeyTwo },
          createdAt: new Date('2026-09-20T12:00:00Z'),
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
        reportingTimeZone: 'UTC',
        journeyIds: [journeyOne, journeyTwo, journeyNoStart],
        unattributedEventCount: 0,
        rowLimitReached: false,
        providerLimited: false,
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
      providerLimited: false,
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
      { idempotencyKey: 'analyze_started:a1', properties: { anonymous: true }, createdAt: new Date('2026-09-20T00:00:00Z') },
      {
        idempotencyKey: 'analyze_started:s1',
        properties: { anonymous: false },
        createdAt: new Date('2026-09-20T00:00:00Z'),
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
        providerLimited: false,
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
      select: { idempotencyKey: true, properties: true, createdAt: true },
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
