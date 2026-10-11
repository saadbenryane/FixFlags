import { describe, expect, it, vi } from 'vitest'
const findMany = vi.hoisted(() => vi.fn().mockResolvedValue([]))
vi.mock('@/lib/db', () => ({ prisma: { auditPipelineEvent: { findMany } } }))
import { readSiteEvents, decodeEventCursor, encodeEventCursor } from '../execution-progress'
import type { SiteRecord } from '@/lib/sites/types'

describe('Site progress read boundary', () => {
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
