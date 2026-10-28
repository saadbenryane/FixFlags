import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ project: vi.fn(), existing: vi.fn(), recent: vi.fn(), outcomes: vi.fn(), request: vi.fn(), operator: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { project: { findFirst: mocks.project }, runRequest: { findUnique: mocks.existing },
  audit: { findFirst: mocks.recent }, siteOutcome: { findMany: mocks.outcomes } } }))
vi.mock('@/lib/admin/domain-actor', () => ({ assertAdminDomainActor: mocks.operator }))
vi.mock('../run-requests', () => ({ requestSiteRun: mocks.request }))
vi.mock('../scheduled-completion', () => ({ commitScheduledRun: vi.fn() }))
import { interruptedAnalysisWorkWhere } from '@/lib/audit/progressive/recorded-completeness'
import { analysisEnvironmentWhere } from '../analysis-scope'
import { requestScheduledSiteRun } from '../scheduled-runs'
import { siteCareIntervalMinutes } from '../../evidence-freshness'

const now = new Date('2026-10-12T12:00:00Z')
const input = { projectId: 'site', userId: 'owner', interval: 'weekly' as const, scheduledAt: now, now }
beforeEach(() => {
  vi.resetAllMocks()
  mocks.project.mockResolvedValue({ url: 'http://www.example.com:8080' })
  mocks.existing.mockResolvedValue(null); mocks.recent.mockResolvedValue(null)
  mocks.outcomes.mockResolvedValue([{ id: 'availability' }])
  mocks.request.mockResolvedValue({ runId: 'run', auditId: 'audit', outcomeIds: ['availability'], reused: false })
})

describe('automatic scheduled Site care', () => {
  it('validates operator authority before reusing an admitted tick', async () => {
    const operator = { kind: 'admin' as const, actorId: 'operator', operationId: 'operation' }
    mocks.existing.mockResolvedValue({ status: 'QUEUED', audit: { projectId: 'site', status: 'QUEUED' }, id: 'recorded', auditId: 'recorded-audit', environment: 'production', verificationTarget: null,
      selections: [], executionSpec: { version: 1, scope: 'SITE', targetUrl: 'https://example.com/',
        environment: 'production', outcomes: [], checks: {}, verificationTarget: null } })
    mocks.operator.mockRejectedValue(new Error('Operator revoked'))
    await expect(requestScheduledSiteRun({ ...input, operator })).rejects.toThrow('Operator revoked')
    expect(mocks.existing).not.toHaveBeenCalled()
    expect(mocks.request).not.toHaveBeenCalled()
  })
  it('requests broad care when its own Site scope needs fresh evidence, preserving the actual configured origin', async () => {
    await requestScheduledSiteRun(input)
    expect(mocks.request).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'site', userId: 'owner', source: 'WATCH',
      scope: 'SITE', outcomeIds: [], context: { cadence: 'weekly' } }))
    expect(mocks.recent).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      url: 'http://www.example.com:8080/', status: 'COMPLETED', AND: [analysisEnvironmentWhere('production')],
      createdAt: { gt: new Date('2026-10-05T12:01:00Z') },
    }) }))
    expect(mocks.outcomes).not.toHaveBeenCalled()
  })
  it('reuses fresh broad evidence while independently requesting enabled production bindings at their saved cadence', async () => {
    mocks.recent.mockResolvedValue({ id: 'recent-site-check', verifierExecutions: [] })
    await requestScheduledSiteRun({ ...input, interval: 'hourly' })
    expect(mocks.outcomes).toHaveBeenCalledWith(expect.objectContaining({ where: { projectId: 'site', enabled: true,
      environment: 'production', bindings: { some: { enabled: true, required: true } } } }))
    expect(mocks.request).toHaveBeenCalledWith(expect.objectContaining({ scope: 'OUTCOMES', outcomeIds: ['availability'], context: { cadence: 'hourly' } }))
    expect(mocks.recent.mock.calls[0][0].select.verifierExecutions.where).toEqual(interruptedAnalysisWorkWhere)
    expect(interruptedAnalysisWorkWhere).toEqual({
      workState: 'EXHAUSTED', status: 'FAILED',
      OR: [{ workKind: null }, { workKind: { notIn: ['prescription', 'pagespeed', 'google', 'judge'] } }],
    })
    expect(mocks.recent.mock.calls[0][0].where.createdAt.gt).toEqual(new Date('2026-10-11T12:01:00Z'))
  })
  it('requests broad recovery when the latest completed analysis exhausted an obligation', async () => {
    mocks.recent.mockResolvedValue({ id: 'interrupted-site-check', verifierExecutions: [{ id: 'interrupted-task' }] })
    await requestScheduledSiteRun({ ...input, interval: 'hourly' })
    expect(mocks.request).toHaveBeenCalledWith(expect.objectContaining({ scope: 'SITE', outcomeIds: [] }))
    expect(mocks.outcomes).not.toHaveBeenCalled()
    expect(mocks.recent).toHaveBeenCalledWith(expect.objectContaining({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }))
  })
  it.each(['SITE', 'OUTCOMES'] as const)('retains an admitted %s tick after scope freshness and configuration change', async scope => {
    mocks.existing.mockResolvedValue({ status: 'QUEUED', audit: { projectId: 'site', status: 'QUEUED' }, id: 'recorded', auditId: 'recorded-audit', environment: 'production', verificationTarget: null,
      selections: [{ outcomeId: 'original-binding-owner' }], executionSpec: { version: 1, scope, targetUrl: 'https://example.com/',
        environment: 'production', outcomes: [], checks: {}, verificationTarget: null } })
    expect(await requestScheduledSiteRun(input)).toEqual({ runId: 'recorded', auditId: 'recorded-audit', outcomeIds: ['original-binding-owner'], reused: true })
    expect(mocks.recent).not.toHaveBeenCalled(); expect(mocks.outcomes).not.toHaveBeenCalled(); expect(mocks.request).not.toHaveBeenCalled()
  })
  it.each([
    { status: 'FAILED', audit: { projectId: 'site', status: 'FAILED' } },
    { status: 'RUNNING', audit: { projectId: 'site', status: 'FAILED' } },
    { status: 'COMPLETED', audit: null },
    { status: 'COMPLETED', audit: { projectId: 'another-site', status: 'COMPLETED' } },
  ])('refuses an unavailable receipt without reinterpreting its scope: %j', async state => {
    mocks.existing.mockResolvedValue({ id: 'recorded', auditId: 'recorded-audit', environment: 'production', verificationTarget: null,
      selections: [], executionSpec: { version: 1, scope: 'SITE', targetUrl: 'https://example.com/', environment: 'production',
        outcomes: [], checks: {}, verificationTarget: null }, ...state })
    await expect(requestScheduledSiteRun(input)).rejects.toMatchObject({ status: 409, code: 'SCHEDULED_RUN_UNAVAILABLE' })
    expect(mocks.request).not.toHaveBeenCalled()
    expect(mocks.recent).not.toHaveBeenCalled()
  })

  it.each(['FAILED', 'COMPLETED'] as const)('checks a %s receipt reused after concurrent admission', async status => {
    mocks.existing.mockResolvedValueOnce(null).mockResolvedValueOnce({ status, audit: { projectId: 'site', status } })
    mocks.request.mockResolvedValue({ runId: 'concurrent', auditId: 'concurrent-audit', outcomeIds: [], reused: true })
    const result = requestScheduledSiteRun(input)
    if (status === 'FAILED') await expect(result).rejects.toMatchObject({ code: 'SCHEDULED_RUN_UNAVAILABLE' })
    else expect(await result).toMatchObject({ runId: 'concurrent', reused: true })
    expect(mocks.existing).toHaveBeenLastCalledWith({ where: { id: 'concurrent', projectId: 'site' },
      select: { status: true, audit: { select: { projectId: true, status: true } } } })
  })

  it('refuses a foreign Site before reading or reusing an execution', async () => {
    mocks.project.mockResolvedValue(null)
    await expect(requestScheduledSiteRun(input)).rejects.toMatchObject({ status: 404 })
    expect(mocks.existing).not.toHaveBeenCalled(); expect(mocks.request).not.toHaveBeenCalled()
  })
  it.each([{ environment: 'staging' }, { verificationTarget: { kind: 'DIAGNOSTIC' } }, { executionSpec: null }])('refuses a conflicting scheduled receipt %j', async override => {
    mocks.existing.mockResolvedValue({ status: 'QUEUED', audit: { projectId: 'site', status: 'QUEUED' }, id: 'recorded', environment: 'production', verificationTarget: null,
      executionSpec: { version: 1, scope: 'SITE', targetUrl: 'https://example.com/', environment: 'production', outcomes: [], checks: {}, verificationTarget: null }, ...override })
    await expect(requestScheduledSiteRun(input)).rejects.toMatchObject({ status: 409 })
    expect(mocks.request).not.toHaveBeenCalled()
  })
  it('gives edited cadence a new intent without including mutable execution scope in its key', async () => {
    await requestScheduledSiteRun({ ...input, interval: 'custom', everyMinutes: 180 })
    await requestScheduledSiteRun({ ...input, interval: 'custom', everyMinutes: 240 })
    const keys = mocks.request.mock.calls.map(([request]) => request.idempotencyKey)
    expect(keys[0]).not.toEqual(keys[1])
    expect(keys.every(key => !key.includes('SITE') && !key.includes('OUTCOMES'))).toBe(true)
  })
  it('carries the scheduler claim to the shared transactional admission without persisting it as context', async () => {
    const claim = { attemptedAt: now, leaseUntil: new Date(now.getTime() + 600_000) }
    await requestScheduledSiteRun({ ...input, claim })
    expect(mocks.request).toHaveBeenCalledWith(expect.objectContaining({ scheduledClaim: {
      ...claim, targetUrl: 'http://www.example.com:8080', interval: 'weekly', everyMinutes: null, scheduledAt: now,
    }, context: { cadence: 'weekly' } }))
  })
  it.each([['weekly', undefined, 10080], ['daily', undefined, 1440], ['hourly', undefined, 1440],
    ['custom', 180, 1440], ['custom', 4320, 4320]] as const)('retains %s cadence and bounds repeated broad collection', (interval, everyMinutes, minutes) => {
    expect(siteCareIntervalMinutes(interval, everyMinutes)).toBe(minutes)
  })
})
