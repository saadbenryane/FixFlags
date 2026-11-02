import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import type { SiteRecord } from '@/lib/sites/types'
import { repairFlag } from '@/lib/sites/__tests__/fixtures/repair-brief'
import { pageSpeedMeasurementFixture } from '@/lib/audit/__tests__/check-fixtures'
import { MAX_MCP_CAPTURE_BYTES, MAX_REPAIR_CAPTURE_BYTES } from '@/lib/sites/repair-evidence-contract'

const mocks = vi.hoisted(() => ({ finding: vi.fn(), request: vi.fn(), screenshot: vi.fn(), artifact: vi.fn(), performance: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { journeyFinding: { findFirst: mocks.finding }, runRequest: { findFirst: mocks.request } } }))
vi.mock('@/lib/storage/screenshots', () => ({ readScreenshot: mocks.screenshot }))
vi.mock('@/lib/integrity/storage', () => ({ readIntegrityArtifact: mocks.artifact }))
vi.mock('../performance-evidence', () => ({ loadPerformanceEvidence: mocks.performance }))
import { loadSiteRepairEvidence } from '../repair-evidence'

const site = { siteId: 'site', projectId: 'project', userId: 'owner' } as SiteRecord
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ZkAAAAASUVORK5CYII=', 'base64')
const captureUrl = 'https://fixflags.test/api/sites/site/flags/original/repair-brief?contextHash=revision&view=capture'
beforeEach(() => {
  vi.resetAllMocks()
  mocks.finding.mockResolvedValue(null)
  mocks.screenshot.mockResolvedValue(png)
  mocks.artifact.mockResolvedValue(png)
  mocks.request.mockResolvedValue(null)
  mocks.performance.mockResolvedValue([])
})
describe('source-specific agent evidence', () => {
  it('reads only the persisted source Flag, Audit and Site and never substitutes a Site capture', async () => {
    expect(await loadSiteRepairEvidence(site, repairFlag(), captureUrl)).toMatchObject({ evidence: {
      sourceFlagId: 'original', sourceAuditId: 'scan', capture: { state: 'not_recorded' } }, image: null })
    expect(mocks.finding.mock.calls[0][0].where).toEqual({ flagId: 'original',
      journeyReview: { auditId: 'scan', audit: { projectId: 'project' } } })
    expect(mocks.screenshot).not.toHaveBeenCalled()
    expect(mocks.artifact).not.toHaveBeenCalled()
  })
  it('returns a bounded native image and checksum without fetching the recorded URL', async () => {
    mocks.finding.mockResolvedValue({ id: 'finding', url: 'https://example.com/checkout', screenshotUrl: 'https://storage.invalid/api/screenshots/scan/mobile?page=step_1', createdAt: new Date('2026-10-29T10:00:00Z') })
    const result = await loadSiteRepairEvidence(site, repairFlag(), captureUrl)
    expect(mocks.screenshot).toHaveBeenCalledWith('scan', 'mobile', 'step_1')
    expect(result).toMatchObject({ evidence: { capture: { state: 'available', bytes: png.length, url: captureUrl,
      sha256: createHash('sha256').update(png).digest('hex') } }, image: png })
    expect(JSON.stringify(result.evidence)).not.toContain(png.toString('base64'))
  })
  it.each(['https://example.test/image.png', '/api/screenshots/another-scan/desktop',
    '/api/screenshots/scan/desktop?page=../private', '/api/integrity-assets/path-other-123/capture.png'])
  ('refuses an unbound or arbitrary asset reference: %s', async screenshotUrl => {
    mocks.finding.mockResolvedValue({ id: 'finding', url: 'https://example.com/checkout', screenshotUrl, createdAt: new Date() })
    expect(await loadSiteRepairEvidence(site, repairFlag(), captureUrl)).toMatchObject({ evidence: { capture: { state: 'unavailable' } }, image: null })
    expect(mocks.screenshot).not.toHaveBeenCalled()
    expect(mocks.artifact).not.toHaveBeenCalled()
  })
  it('requires an Outcome artifact to belong to this exact request, Audit and Site', async () => {
    mocks.finding.mockResolvedValue({ id: 'finding', url: 'https://example.com/checkout', screenshotUrl: '/api/integrity-assets/outcome-request123-before/capture.png', createdAt: new Date() })
    expect((await loadSiteRepairEvidence(site, repairFlag(), captureUrl)).image).toBeNull()
    expect(mocks.request).toHaveBeenCalledWith({ where: { id: 'request123', projectId: 'project', auditId: 'scan' }, select: { id: true } })
    expect(mocks.artifact).not.toHaveBeenCalled()
    mocks.request.mockResolvedValue({ id: 'request123' })
    expect((await loadSiteRepairEvidence(site, repairFlag(), captureUrl)).image).toEqual(png)
  })
  it('retains a larger bounded image for authenticated artifact retrieval without inline MCP content', async () => {
    mocks.finding.mockResolvedValue({ id: 'finding', url: 'https://example.com/checkout', screenshotUrl: '/api/screenshots/scan/desktop', createdAt: new Date() })
    const large = Buffer.concat([png, Buffer.alloc(MAX_MCP_CAPTURE_BYTES)])
    mocks.screenshot.mockResolvedValue(large)
    expect(await loadSiteRepairEvidence(site, repairFlag(), captureUrl)).toMatchObject({ image: large,
      evidence: { capture: { state: 'available', nativeImage: false, bytes: large.length, url: captureUrl } } })
  })
  it.each(['missing', 'invalid', 'too_large', 'storage_error'])('keeps %s media explicit without embedding unusable bytes', async state => {
    mocks.finding.mockResolvedValue({ id: 'finding', url: 'https://example.com/checkout', screenshotUrl: '/api/screenshots/scan/desktop', createdAt: new Date() })
    mocks.screenshot.mockResolvedValue(state === 'missing' ? null : state === 'invalid' ? Buffer.from('private text') : Buffer.alloc(MAX_REPAIR_CAPTURE_BYTES + 1))
    if (state === 'storage_error') mocks.screenshot.mockRejectedValue(new Error('Storage credentials are private'))
    const result = await loadSiteRepairEvidence(site, repairFlag(), captureUrl)
    expect(result.image).toBeNull()
    expect(result.evidence.capture.state).toBe(state === 'too_large' ? 'too_large' : 'unavailable')
    expect(JSON.stringify(result.evidence)).not.toContain('credentials')
  })
  it('reads recorded performance conditions only for the original deterministic lab finding', async () => {
    const flag = repairFlag({ checkId: 'lcp-poor' })
    const measurements = [pageSpeedMeasurementFixture(flag.pageUrl!)]
    mocks.performance.mockResolvedValue(measurements)
    expect((await loadSiteRepairEvidence(site, flag, captureUrl)).evidence.performanceMeasurements).toEqual(measurements)
    expect(mocks.performance).toHaveBeenCalledWith(site, 'scan', flag.pageUrl)
    mocks.performance.mockClear()
    await loadSiteRepairEvidence(site, repairFlag({ checkId: 'lcp-poor', evidenceContext: { ...flag.evidenceContext!, source: 'AI' } }), captureUrl)
    expect(mocks.performance).not.toHaveBeenCalled()
  })
})
