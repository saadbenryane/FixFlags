import { beforeEach, describe, expect, it, vi } from 'vitest'
const findMany = vi.hoisted(() => vi.fn().mockResolvedValue([]))
const progress = vi.hoisted(() => ({ authorize: vi.fn(), audit: vi.fn(), tasks: vi.fn(), counts: vi.fn(), event: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/db', () => ({ prisma: { auditPipelineEvent: { findMany, findFirst: progress.event }, audit: { findFirst: progress.audit },
  project: { findFirst: progress.authorize },
  $queryRaw: progress.tasks, auditExecutionTask: { groupBy: progress.counts } } }))
import { readSiteEvents, decodeEventCursor, encodeEventCursor, loadExecutionProgress } from '../execution-progress'
import { MAX_TASKS_PER_AUDIT } from '@/lib/audit/progressive/contracts'
import type { SiteRecord } from '@/lib/sites/types'
import { cardExecution } from '@/lib/sites/card-execution'

describe('Site progress read boundary', () => {
  beforeEach(() => { progress.authorize.mockReset().mockResolvedValue({ id: 'project-one' }) })
  it('keeps recovery from a late task visible across the complete supported graph', async () => {
    const rows = Array.from({ length: MAX_TASKS_PER_AUDIT }, (_, index) => ({ id: 'task-' + index, status: 'COMPLETED', workState: 'COMPLETED',
      workKind: 'check', pageUrl: 'https://example.com/', module: 'metadata', device: null,
      workAttempts: 1, workErrorCode: null as string | null, workRetryAt: null }))
    Object.assign(rows.at(-1)!, { status: 'FAILED', workState: 'BLOCKED', workErrorCode: 'STORAGE_NOT_CONFIGURED' })
    Object.assign(rows.at(-2)!, { status: 'RUNNING', workState: 'RUNNING', workKind: 'pagespeed', module: null })
    progress.audit.mockResolvedValue({ recoveryUntil: null })
    progress.tasks.mockImplementation((_query: unknown, ...values: unknown[]) => Promise.resolve(rows.slice(0, Number(values.at(-1)))))
    progress.counts.mockResolvedValue([{ status: 'COMPLETED', workState: 'COMPLETED', workErrorCode: null, _count: { _all: rows.length - 2 } },
      { status: 'RUNNING', workState: 'RUNNING', workErrorCode: null, _count: { _all: 1 } },
      { status: 'FAILED', workState: 'BLOCKED', workErrorCode: 'STORAGE_NOT_CONFIGURED', _count: { _all: 1 } }])
    const result = await loadExecutionProgress({ siteId: 'site-one', projectId: 'project-one' } as SiteRecord, 'audit-one')
    expect(result).toMatchObject({ total: MAX_TASKS_PER_AUDIT, recovery: { action: 'support', reasons: ['STORAGE_NOT_CONFIGURED'] } })
    expect(result?.tasks).toHaveLength(100)
    expect(cardExecution('performance', result)?.status).toBe('Running')
  })
  it('scopes owned events to the exact Project and bounds replay', async () => {
    await readSiteEvents({ siteId: 'site-one', kind: 'project', projectId: 'project-one', userId: 'owner' } as SiteRecord, BigInt(7))
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { event: 'projection_changed', sequence: { gt: BigInt(7) }, audit: { projectId: 'project-one' } }, take: 100,
    }))
  })
  it('withholds an admitted notice when ownership changes during collection', async () => {
    progress.authorize.mockResolvedValueOnce({ id: 'project-one' }).mockResolvedValueOnce(null)
    findMany.mockResolvedValueOnce([{ sequence: BigInt(8), auditId: 'private-audit', detail: { version: 1 } }])
    await expect(readSiteEvents({ siteId: 'site-one', kind: 'project', projectId: 'project-one', userId: 'owner' } as SiteRecord, BigInt(7)))
      .rejects.toMatchObject({ status: 404 })
  })
  it('scopes provisional events to the owned primary Audit', async () => {
    await readSiteEvents({ siteId: 'site-provisional', projectId: null, primaryAuditId: 'audit-owned' } as SiteRecord, BigInt(0))
    expect(findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ audit: { id: 'audit-owned' } }) }))
  })
  it('rejects malformed, oversized, and cross-Site cursors', () => {
    expect(decodeEventCursor('site-one', encodeEventCursor('site-one', BigInt(42)))).toBe(BigInt(42))
    for (const cursor of ['invalid', 'x'.repeat(513), encodeEventCursor('other-site', BigInt(42)),
      encodeEventCursor('site-one', BigInt('9223372036854775808'))]) expect(() => decodeEventCursor('site-one', cursor)).toThrow('Invalid')
  })
})
