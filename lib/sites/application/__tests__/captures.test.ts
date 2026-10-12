import { beforeEach, describe, expect, it, vi } from 'vitest'
const find = vi.hoisted(() => vi.fn())
vi.mock('@/lib/db', () => ({ prisma: { screenshot: { findFirst: find } } }))
import { loadSiteCaptures } from '../captures'
const shot = { url: '/api/screenshots/current/desktop.png', width: 1280, height: 720, recordedAt: new Date('2026-10-12T12:00:00Z'), audit: { url: 'https://example.com/' }, page: null }
beforeEach(() => { find.mockReset() })
describe('website capture provenance', () => {
  it('retains the recorded audit and device without substituting missing mobile evidence', async () => {
    find.mockImplementation(async ({ where }) => where.auditId === 'prior' && where.device === 'DESKTOP' ? shot : null)
    const captures = await loadSiteCaptures('current', 'prior', true)
    expect(captures).toHaveLength(1)
    expect(captures[0]).toMatchObject({ auditId: 'prior', device: 'desktop', previous: true, recordedAt: '2026-10-12T12:00:00.000Z' })
    expect(find.mock.calls.every(([query]) => ['current', 'prior'].includes(query.where.auditId))).toBe(true)
    expect(find.mock.calls[0][0].where.OR).toEqual([{ pageId: null }, { page: { position: 0 } }])
  })
  it('keeps legacy recording time unknown and marks retained evidence during a retry', async () => {
    find.mockResolvedValue({ ...shot, recordedAt: null })
    const captures = await loadSiteCaptures('current', null, true, new Date('2026-10-12T13:00:00Z'))
    expect(captures.every(capture => capture.recordedAt === null && capture.previous)).toBe(true)
  })
  it('marks new captures as current while keeping older captures from the same audit previous', async () => {
    find.mockImplementation(async ({ where }) => ({ ...shot, recordedAt: new Date(where.device === 'DESKTOP' ? '2026-10-12T14:00:00Z' : '2026-10-12T12:00:00Z') }))
    const captures = await loadSiteCaptures('current', null, true, new Date('2026-10-12T13:00:00Z'))
    expect(captures.map(capture => capture.previous)).toEqual([false, true])
  })
})
