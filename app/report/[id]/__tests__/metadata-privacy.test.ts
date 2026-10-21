import { beforeEach, describe, expect, it, vi } from 'vitest'

const load = vi.hoisted(() => vi.fn())
vi.mock('@/lib/audit/fetch-audit', () => ({ getProgressiveAuditForRequest: load }))
vi.mock('../load-report-route-state', () => ({ loadReportRouteState: vi.fn() }))
vi.mock('../CompletedReportView', () => ({ CompletedReportView: () => null }))
vi.mock('@/components/layout/audit-shell', () => ({ AuditShell: () => null }))
vi.mock('@/components/report/ReportWorkspaceState', () => ({ ReportWorkspaceState: () => null }))
import { generateMetadata } from '../page'

describe('private report metadata', () => {
  beforeEach(() => load.mockReset())

  it.each([null, 'owner'])('keeps initial and claimed private evidence out of indexing and previews: %s', async userId => {
    load.mockResolvedValue({ kind: 'completed', audit: { url: 'https://private.example.com/secret-path',
      userId, isPublic: false, flags: [{ severity: 'IMPORTANT', problem: 'Private observed condition' }] } })
    const metadata = await generateMetadata({ params: Promise.resolve({ id: 'private' }) })
    expect(metadata.robots).toEqual({ index: false, follow: false })
    expect(metadata.openGraph).toBeUndefined()
    expect(metadata.twitter).toBeUndefined()
    expect(metadata.alternates).toBeUndefined()
    expect(JSON.stringify(metadata)).not.toContain('private.example.com')
    expect(JSON.stringify(metadata)).not.toContain('Private observed condition')
  })

  it('preserves metadata for existing public anonymous reports', async () => {
    load.mockResolvedValue({ kind: 'completed', audit: { url: 'https://example.com/', userId: null,
      isPublic: true, flags: [{ severity: 'IMPORTANT', problem: 'Recorded public condition' }] } })
    const metadata = await generateMetadata({ params: Promise.resolve({ id: 'historical-public' }) })
    expect(metadata.robots).toEqual({ index: true, follow: true })
    expect(metadata.description).toContain('Recorded public condition')
    expect(metadata.openGraph).toMatchObject({ url: expect.stringContaining('/report/historical-public') })
  })
})
