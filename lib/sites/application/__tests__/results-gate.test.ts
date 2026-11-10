import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ audit: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { audit: { findUnique: mocks.audit } } }))
import { loadSiteResultsGate, siteResultsGateState } from '../results-gate'
import type { SiteRecord } from '@/lib/sites/types'

const site = { siteId: 'p_visitor', kind: 'provisional', url: 'https://www.example.com/', canonicalHost: 'www.example.com', name: 'Example',
  projectId: null, provisionalSiteId: 'visitor', primaryAuditId: 'audit-1', watchInterval: null, watchNextRunAt: null, watchPausedAt: null,
  watchLastRunAt: null, watchLastError: null, watchConsecutiveFailures: 0, userId: null } satisfies SiteRecord

beforeEach(() => { vi.clearAllMocks() })

describe('Site results gate', () => {
  it('reads only the check status, never its findings', async () => {
    mocks.audit.mockResolvedValue({ status: 'CHECKING' })
    expect(await loadSiteResultsGate(site, false)).toEqual({ kind: 'results_gate', siteId: 'p_visitor', host: 'example.com',
      state: 'running', stage: 1, continuation: 'sign_in' })
    expect(mocks.audit).toHaveBeenCalledWith({ where: { id: 'audit-1' }, select: { status: true } })
  })

  it('asks a signed-in visitor to claim and a signed-out visitor to sign up', async () => {
    mocks.audit.mockResolvedValue({ status: 'COMPLETED' })
    expect(await loadSiteResultsGate(site, true)).toMatchObject({ state: 'ready', stage: 3, continuation: 'claim' })
  })

  it('maps every status to running, ready or failed', () => {
    expect(['QUEUED', 'CAPTURING', 'CHECKING', 'JUDGING', 'FINALIZING', null].map(siteResultsGateState)).toEqual(Array(6).fill('running'))
    expect(siteResultsGateState('COMPLETED')).toBe('ready')
    expect(siteResultsGateState('FAILED')).toBe('failed')
  })
})
