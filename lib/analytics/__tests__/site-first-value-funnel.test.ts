import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FIXFLAGS_LANDING_SCOPE } from '@/lib/growth/reporting-targets'

const findLifecycleEvents = vi.hoisted(() => vi.fn())
const findAudits = vi.hoisted(() => vi.fn())
const findGrowthArtifact = vi.hoisted(() => vi.fn())
const readOnly = vi.hoisted(() => vi.fn())
const transaction = vi.hoisted(() => vi.fn())

const db = {
  siteLifecycleEvent: { findMany: findLifecycleEvents },
  audit: { findMany: findAudits },
  growthArtifact: { findUnique: findGrowthArtifact },
  $executeRaw: readOnly,
}
vi.mock('@/lib/db', () => ({ prisma: { $transaction: transaction } }))

import {
  calculateSiteFirstValueFunnel,
  loadSiteFirstValueFunnel,
  parseLandingJourneyArtifact,
} from '../site-first-value-funnel'

const createdAt = new Date('2026-09-20T00:00:00Z')
const completionAt = new Date('2026-09-20T13:00:00Z')
const unclaimed = { createdAt, projectId: null, project: null, userId: null }
const owned = (userId: string) => ({ createdAt, projectId: 'site', project: { id: 'site', userId, deletedAt: null }, userId })
const claim = (id: string, userId: string) => ({
  idempotencyKey: `analysis_claimed:${id}`, projectId: 'site', userId, createdAt: new Date('2026-09-21T00:00:00Z'),
})

describe('Site first-value funnel', () => {
  it('keeps completed analyses with missing receipts separate from active work', () => {
    const statuses = ['COMPLETED', 'COMPLETED', 'FAILED', 'QUEUED', 'CAPTURING', 'CHECKING', 'JUDGING', 'FINALIZING']
    const audits = statuses.map((status, index) => ({
      id: `analysis-${index}`, ...unclaimed, status, utmSource: null, source: 'HOMEPAGE',
    }))
    const starts = [...audits.map(audit => audit.id), 'missing-audit'].map(id => ({
      idempotencyKey: `analyze_started:${id}`, properties: { anonymous: true },
    }))
    const funnel = calculateSiteFirstValueFunnel({
      starts, audits, results: [{ idempotencyKey: 'analysis_completed:analysis-1', createdAt: completionAt }],
    })
    expect(funnel).toMatchObject({
      started: 9, firstUsefulResult: 1, completedWithoutReceipt: 1,
      failedBeforeResult: 1, stillRunning: 5, missingAudit: 1,
    })
    expect(funnel.resultRate).toBe(11)
  })

  it('reports completion independently of usefulness and keeps historical receipts compatible', () => {
    const result = calculateSiteFirstValueFunnel({
      starts: [{ idempotencyKey: 'analyze_started:completed', properties: { anonymous: true } }],
      audits: [{ id: 'completed', ...unclaimed, status: 'COMPLETED', utmSource: null, source: 'HOMEPAGE' }],
      results: [{ idempotencyKey: 'analysis_completed:completed', createdAt: completionAt }, { idempotencyKey: 'first_useful_result:completed', createdAt: completionAt }, { idempotencyKey: 'flag-feedback:unrelated:1:none', createdAt: completionAt }],
    })
    expect(result).toMatchObject({ analysisCompleted: 1, customerUsefulnessAssessed: false,
      sources: [{ analysisCompleted: 1 }], landing: { completedAnalysisSessions: null } })
    expect(result.firstUsefulResult).toBe(result.analysisCompleted)
    expect(result.sources[0].firstUsefulResult).toBe(result.sources[0].analysisCompleted)
  })

  it.each(['analysis_completed:', 'analysis_completed: completed', 'first_useful_result:completed '])('rejects a completion receipt without its exact recorded identity (%s)', key => {
    const result = calculateSiteFirstValueFunnel({
      starts: [{ idempotencyKey: 'analyze_started:completed', properties: { anonymous: true } }],
      audits: [{ id: 'completed', ...unclaimed, status: 'COMPLETED', utmSource: null, source: 'HOMEPAGE' }],
      results: [{ idempotencyKey: key, createdAt: completionAt }],
    })
    expect(result.analysisCompleted).toBe(0)
    expect(result.customerUsefulnessAssessed).toBe(false)
  })

  beforeEach(() => {
    findLifecycleEvents.mockReset()
    findAudits.mockReset()
    findGrowthArtifact.mockReset().mockResolvedValue(null)
    transaction.mockReset().mockImplementation(run => run(db))
    readOnly.mockClear()
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

  it('leaves an unscoped key-bearing export unavailable', async () => {
    const journeyId = `ffj_${'1'.repeat(32)}`
    const since = new Date('2026-10-01T00:00:00Z')
    findGrowthArtifact.mockResolvedValue({ payload: {
      status: 'available', fetchedAt: '2026-10-03T12:00:00Z',
      startDate: '2026-09-05', endDate: '2026-10-03', reportingTimeZone: 'UTC',
      journeys: [{ journeyId, eventCount: 1 }], unattributedEventCount: 0, rowLimitReached: false,
    } })
    findLifecycleEvents.mockResolvedValue([])
    const result = await loadSiteFirstValueFunnel(since)
    expect(findLifecycleEvents.mock.calls[0][0].where.createdAt.gte).toEqual(since)
    expect(result.landing).toMatchObject({ status: 'incomparable', startedSessions: null, claimRate: null, startRate: null })
    expect(findAudits).not.toHaveBeenCalled()
  })

  it('reads the stored aggregate without reconstructing the provider cohort', async () => {
    const since = new Date('2026-10-12T00:00:00Z')
    const payload = {
      version: 4, scope: FIXFLAGS_LANDING_SCOPE,
      status: 'available', fetchedAt: '2026-10-13T12:00:00Z', computedAt: '2026-10-13T12:00:01Z',
      startDate: '2026-09-07', endDate: '2026-10-04', reportingTimeZone: 'UTC', landingSessions: 3, startedSessions: 2,
      completedAnalysisSessions: 1, claimedSessions: 1, startRate: 67, resultRate: 33, claimRate: 33,
      followupComplete: true, unattributedEventCount: 0, rowLimitReached: false, providerLimited: false,
    }
    findGrowthArtifact.mockResolvedValue({ payload })
    findLifecycleEvents.mockResolvedValue([])
    const result = await loadSiteFirstValueFunnel(since)
    expect(result.landing).toMatchObject({ landingSessions: 3, startedSessions: 2, firstUsefulResultSessions: 1,
      instrumentedStarts: 0, claimedSessions: 1, claimRate: 33, computedAt: '2026-10-13T12:00:01Z' })
    expect(findLifecycleEvents.mock.calls[0][0].where.createdAt.gte).toEqual(since)
    expect(findAudits).not.toHaveBeenCalled()
    findGrowthArtifact.mockResolvedValue({ payload: { ...payload, version: 3 } })
    expect((await loadSiteFirstValueFunnel(since)).landing).toMatchObject({
      status: 'partial', landingSessions: 3, claimedSessions: 1, startRate: null, resultRate: null, claimRate: null,
    })
    for (const source of [
      { ...payload, version: 2 },
      { ...payload, scope: { ...FIXFLAGS_LANDING_SCOPE, hostname: 'preview.fixflags.com' } },
      { ...payload, scope: { ...FIXFLAGS_LANDING_SCOPE, streamId: 'other-stream' } },
      { ...payload, scope: { ...FIXFLAGS_LANDING_SCOPE, property: 'other-property' } },
      { ...payload, scope: { ...FIXFLAGS_LANDING_SCOPE, pagePath: '/new' } },
    ]) {
      findGrowthArtifact.mockResolvedValue({ payload: source })
      expect((await loadSiteFirstValueFunnel(since)).landing).toMatchObject({
        status: 'incomparable', landingSessions: null, claimRate: null,
      })
    }
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
          createdAt,
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
          ...unclaimed,
          status: 'COMPLETED',
          utmSource: 'search',
          source: 'HOMEPAGE',
        },
        {
          id: 'a2',
          ...owned('user-1'),
          status: 'COMPLETED',
          utmSource: 'search',
          source: 'HOMEPAGE',
        },
        {
          id: 'a3',
          ...unclaimed,
          status: 'FAILED',
          utmSource: null,
          source: 'TOOL_PAGE',
        },
      ],
      results: [
        { idempotencyKey: 'first_useful_result:a1', createdAt: completionAt },
        { idempotencyKey: 'first_useful_result:a2', createdAt: completionAt },
        { idempotencyKey: 'first_useful_result:not-in-cohort', createdAt: completionAt },
      ],
      claims: [claim('a2', 'user-1')],
    })

    expect(funnel).toEqual({
      started: 3,
      analysisCompleted: 2,
      customerUsefulnessAssessed: false,
      firstUsefulResult: 2,
      resultRate: 67,
      claimed: 1,
      claimRate: 33,
      failedBeforeResult: 1,
      stillRunning: 0,
      completedWithoutReceipt: 0,
      missingAudit: 0,
      sources: [
        { source: 'search', started: 2, analysisCompleted: 2, firstUsefulResult: 2, claimed: 1 },
        { source: 'tool page', started: 1, analysisCompleted: 0, firstUsefulResult: 0, claimed: 0 },
      ],
      landing: {
        status: 'missing',
        fetchedAt: null,
        startDate: null,
        endDate: null,
        landingSessions: null,
        startedSessions: null,
        completedAnalysisSessions: null,
        firstUsefulResultSessions: null,
        claimedSessions: null,
        startRate: null,
        resultRate: null,
        claimRate: null,
        instrumentedStarts: 0,
        unattributedEventCount: 0,
        rowLimitReached: false,
        providerLimited: false,
        followupComplete: false,
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
        { id: 'a1', ...owned('user-1'), status: 'COMPLETED', utmSource: null, source: 'HOMEPAGE' },
        { id: 'a2', ...unclaimed, status: 'COMPLETED', utmSource: null, source: 'HOMEPAGE' },
        { id: 'a3', ...unclaimed, status: 'FAILED', utmSource: null, source: 'HOMEPAGE' },
      ],
      results: [
        { idempotencyKey: 'first_useful_result:a1', createdAt: completionAt },
        { idempotencyKey: 'first_useful_result:a2', createdAt: completionAt },
      ],
      claims: [claim('a1', 'user-1')],
      asOf: new Date('2026-10-11T00:00:00Z'),
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
      completedAnalysisSessions: 2,
      firstUsefulResultSessions: 2,
      claimedSessions: 1,
      startRate: 67,
      resultRate: 67,
      claimRate: 33,
      instrumentedStarts: 3,
      startReceiptCoverage: { retainedStarts: 3, withUsableTabKey: 3, withExactLandingMatch: 3 },
      unattributedEventCount: 0,
      rowLimitReached: false,
      providerLimited: false,
      followupComplete: true,
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
          ...unclaimed,
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
    expect(funnel.claimRate).toBeNull()
    expect(funnel.sources).toEqual([
      { source: 'unknown', started: 1, analysisCompleted: 0, firstUsefulResult: 0, claimed: 0 },
    ])
  })

  it('uses dated follow-up from exact starts and waits for the entire export to mature', () => {
    const keys = ['a', 'b', 'c'].map(value => `ffj_${value.repeat(32)}`)
    const startAt = new Date('2026-09-20T12:00:00Z')
    const end = new Date('2026-09-27T12:00:00Z')
    const late = new Date(end.getTime() + 1)
    const input = {
      starts: keys.map((journeyId, i) => ({
        idempotencyKey: `analyze_started:a${i}`, createdAt: startAt, properties: { anonymous: true, journeyId },
      })),
      audits: keys.map((_, i) => ({ id: `a${i}`, ...owned('owner'), status: 'COMPLETED', utmSource: null, source: 'HOMEPAGE' })),
      results: [
        // The writer may finish before the start receipt, but never before admission.
        { idempotencyKey: 'analysis_completed:a0', createdAt: new Date('2026-09-20T11:59:59Z') },
        { idempotencyKey: 'first_useful_result:a1', createdAt: end },
        { idempotencyKey: 'analysis_completed:a2', createdAt: late },
        { idempotencyKey: 'first_useful_result:a2', createdAt: new Date('2026-09-19T23:59:59Z') },
      ],
      claims: [{ ...claim('a0', 'owner'), createdAt: end }, { ...claim('a1', 'owner'), createdAt: late },
        { ...claim('a2', 'owner'), createdAt: late }],
      landingArtifact: {
        status: 'available' as const, fetchedAt: '2026-10-03T12:00:00Z', startDate: '2026-09-05', endDate: '2026-10-03',
        reportingTimeZone: 'UTC', journeyIds: keys, unattributedEventCount: 0, rowLimitReached: false,
      },
    }
    const asOf = new Date('2026-10-11T00:00:00Z')
    expect(calculateSiteFirstValueFunnel({ ...input, asOf }).landing).toMatchObject({
      startRate: 100, resultRate: 67, claimRate: 33, completedAnalysisSessions: 2, claimedSessions: 1, followupComplete: true,
    })
    expect(calculateSiteFirstValueFunnel({ ...input, asOf: new Date(asOf.getTime() - 1) }).landing).toMatchObject({
      startRate: 100, resultRate: null, claimRate: null, completedAnalysisSessions: 2, claimedSessions: 1, followupComplete: false,
    })
    expect(calculateSiteFirstValueFunnel({
      ...input, asOf, landingArtifact: { ...input.landingArtifact, status: 'partial', providerLimited: true },
    }).landing).toMatchObject({
      startRate: null, resultRate: null, claimRate: null, completedAnalysisSessions: 2, claimedSessions: 1, followupComplete: true,
    })
    expect(calculateSiteFirstValueFunnel({ ...input, asOf, audits: input.audits.slice(0, 2) }).landing).toMatchObject({
      startRate: 100, resultRate: null, claimRate: null, completedAnalysisSessions: 2, claimedSessions: 1,
    })
  })

  it.each([
    ['no claim', []], ['a claim for another Audit', [claim('another-audit', 'owner')]],
    ['a claim by another owner', [claim('a1', 'other-owner')]],
    ['a claim for another Site', [{ ...claim('a1', 'owner'), projectId: 'another-site' }]],
    ['a claim before the start', [{ ...claim('a1', 'owner'), createdAt: new Date('2026-09-20T06:00:00Z') }]],
    ['a claim after the report time', [{ ...claim('a1', 'owner'), createdAt: new Date('2026-10-05T00:00:01Z') }]],
  ])('withholds Admin claim rates when the exact retained claim is unproven: %s', (_claim, claims) => {
    const journeyId = `ffj_${'1'.repeat(32)}`
    const result = calculateSiteFirstValueFunnel({
      starts: [{ idempotencyKey: 'analyze_started:a1', createdAt: new Date('2026-09-20T12:00:00Z'),
        properties: { anonymous: true, journeyId } }],
      audits: [{ id: 'a1', ...owned('owner'), status: 'COMPLETED', utmSource: null, source: 'HOMEPAGE' }],
      results: [], claims, asOf: new Date('2026-10-05T00:00:00Z'),
      landingArtifact: { status: 'available', fetchedAt: '2026-10-03T12:00:00Z', startDate: '2026-09-05', endDate: '2026-10-03',
        reportingTimeZone: 'UTC', journeyIds: [journeyId], unattributedEventCount: 0, rowLimitReached: false },
    })
    expect(result).toMatchObject({ claimed: 0, claimRate: null, landing: { claimedSessions: 0, claimRate: null } })
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
      .mockResolvedValueOnce([{ idempotencyKey: 'first_useful_result:a1', createdAt: completionAt }])
      .mockResolvedValueOnce([claim('a1', 'user-1')])
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
        ...owned('user-1'),
        status: 'COMPLETED',
        utmSource: null,
        source: 'HOMEPAGE',
      },
    ])

    const funnel = await loadSiteFirstValueFunnel(since)

    expect(findLifecycleEvents).toHaveBeenNthCalledWith(1, {
      where: { name: 'analyze_started', version: 1, userId: null, createdAt: { gte: since, lte: expect.any(Date) } },
      select: { idempotencyKey: true, properties: true, createdAt: true },
    })
    expect(findGrowthArtifact).toHaveBeenCalledWith({
      where: { path: 'ga/rolling-28d/landing-journeys' },
      select: { payload: true },
    })
    expect(findLifecycleEvents).toHaveBeenNthCalledWith(2, {
      where: {
        name: { in: ['analysis_completed', 'first_useful_result'] },
        version: 1,
        createdAt: { lte: expect.any(Date) },
        idempotencyKey: { in: ['analysis_completed:a1', 'first_useful_result:a1'] },
      },
      select: { idempotencyKey: true, createdAt: true },
    })
    expect(findLifecycleEvents).toHaveBeenNthCalledWith(3, {
      where: { name: 'analysis_claimed', version: 1, createdAt: { lte: expect.any(Date) },
        idempotencyKey: { in: ['analysis_claimed:a1'] } },
      select: { idempotencyKey: true, projectId: true, userId: true, createdAt: true },
    })
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'RepeatableRead' })
    expect(readOnly.mock.calls[0][0].join('')).toBe('SET TRANSACTION READ ONLY')
    expect(funnel).toMatchObject({
      started: 1,
      firstUsefulResult: 1,
      claimed: 1,
    })
  })
})
