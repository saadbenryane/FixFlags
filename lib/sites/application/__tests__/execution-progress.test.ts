import { describe, expect, it, vi } from 'vitest'
const findMany = vi.hoisted(() => vi.fn().mockResolvedValue([]))
const auditRead = vi.hoisted(() => vi.fn())
vi.mock('@/lib/db', () => ({ prisma: { audit: { findFirst: auditRead }, auditExecutionTask: { groupBy: vi.fn(async () => []) },
  auditPipelineEvent: { findMany, findFirst: vi.fn(async () => null) } } }))
import { loadExecutionProgress, readSiteEvents, decodeEventCursor, encodeEventCursor } from '../execution-progress'
import type { SiteRecord } from '@/lib/sites/types'

describe('Site progress read boundary', () => {
  it('projects pending primary capture work independently from linked-page collection', async () => {
    const task = (id: string, primary: boolean, workState: string) => ({ id, workKind: 'captures', status: 'COMPLETED', workState,
      workInput: { pageUrl: 'https://example.com/' + id, position: primary ? 0 : 1, primary, role: primary ? 'primary' : 'linked' },
      workAttempts: 1, workErrorCode: null, workRetryAt: null })
    const site = { siteId: 'site-one', projectId: 'project-one' } as SiteRecord
    auditRead.mockResolvedValue({ status: 'CHECKING', recoveryUntil: null, executionTasks: [task('primary', true, 'RUNNING'), task('linked', false, 'EXHAUSTED')] })
    expect((await loadExecutionProgress(site, 'audit'))?.captureState).toBe('pending')
    auditRead.mockResolvedValue({ status: 'CHECKING', recoveryUntil: null, executionTasks: [task('primary', true, 'COMPLETED'), task('linked', false, 'RUNNING')] })
    expect((await loadExecutionProgress(site, 'audit'))?.captureState).toBe('not_recorded')
  })
  it('scopes owned events to the exact Project and bounds replay', async () => {
    await readSiteEvents({ siteId: 'site-one', projectId: 'project-one' } as SiteRecord, BigInt(7))
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { event: 'projection_changed', sequence: { gt: BigInt(7) }, audit: { projectId: 'project-one' } }, take: 100,
    }))
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
