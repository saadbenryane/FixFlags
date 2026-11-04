import { beforeEach, describe, expect, it, vi } from 'vitest'
const find = vi.hoisted(() => vi.fn())
const findPages = vi.hoisted(() => vi.fn())
vi.mock('@/lib/db', () => ({ prisma: { screenshot: { findFirst: find }, auditPage: { findMany: findPages } } }))
import { loadSiteCaptures, loadSiteCheckedPages } from '../captures'
const shot = { url: '/api/screenshots/current/desktop.png', width: 1280, height: 720, recordedAt: new Date('2026-10-12T12:00:00Z'), audit: { url: 'https://example.com/' }, page: null }
beforeEach(() => { find.mockReset(); findPages.mockReset() })
describe('website capture provenance', () => {
  it('keeps a retained capture previous after the latest check has finished without an image', async () => {
    find.mockImplementation(async ({ where }) => where.auditId === 'prior' && where.device === 'DESKTOP' ? { ...shot, url: '/api/screenshots/prior/desktop.png' } : null)
    const captures = await loadSiteCaptures('current', 'prior', false)
    expect(captures[0]).toMatchObject({ auditId: 'prior', previous: true, url: '/api/screenshots/prior/desktop.png' })
  })
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
  it('retains page-specific captures from the selected audit without substituting a homepage or another audit', async () => {
    const page = { url: 'https://example.com/contact', title: 'Contact', status: 'PARTIAL', updatedAt: new Date('2026-10-12T12:00:00Z') }
    findPages.mockResolvedValue([
      { ...page, screenshots: [{ ...shot, url: 'https://fixflags.example/api/screenshots/current/mobile?page=contact' }] },
      { ...page, url: 'https://example.com/shop', screenshots: [] },
      { ...page, url: 'https://example.com/pricing', screenshots: [{ ...shot, url: '/api/screenshots/other/desktop?page=pricing' }] },
    ])
    const pages = await loadSiteCheckedPages('current')
    expect(pages[0]).toMatchObject({ status: 'PARTIAL', capture: { url: '/api/screenshots/current/mobile?page=contact', recordedAt: '2026-10-12T12:00:00.000Z' } })
    expect(pages.slice(1).every(page => page.capture === null)).toBe(true)
    expect(findPages.mock.calls[0][0].where).toEqual({ auditId: 'current' })
    expect(findPages.mock.calls[0][0].select.screenshots.where).toEqual({ auditId: 'current' })
    expect(find).not.toHaveBeenCalled()
  })
})
