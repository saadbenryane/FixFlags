import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import { BoundedSemaphore } from '../../progressive/capacity'

const boundary = vi.hoisted(() => ({
  admit: vi.fn(), save: vi.fn(), upload: vi.fn(), compose: vi.fn(), read: vi.fn(),
}))
vi.mock('../../screenshot', () => ({ getAuditBrowser: async () => ({}) }))
vi.mock('../../browser/page-session', () => ({ createAuditPage: (...args: unknown[]) => boundary.admit(...args) }))
vi.mock('../../scan-access-store', () => ({ resolveAuditScanAccess: async () => null }))
vi.mock('../../execution-ownership', () => ({ executionTransaction: async (write: (tx: unknown) => Promise<unknown>) => write({
  audit: { findUnique: async () => ({ performanceData: {} }), update: boundary.save },
}) }))
vi.mock('@/lib/storage/screenshots', () => ({ uploadScreenshot: (...args: unknown[]) => boundary.upload(...args),
  readScreenshot: (...args: unknown[]) => boundary.read(...args) }))
vi.mock('@/lib/get-app-url', () => ({ getAppUrl: () => 'https://app.example.test' }))
vi.mock('../gif-compositor', () => ({ composeSideBySide: (...args: unknown[]) => boundary.compose(...args) }))
vi.mock('../overlays', () => ({ renderOverlay: async (_kind: unknown, input: { screenshotBuffer: Buffer }) => ({ buffer: input.screenshotBuffer }) }))
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn() } }))
import { tryCaptureVisualEvidenceForAudit } from '../../persist-visual-evidence'
import type { FlowScanResult } from '../../flow/run-flow-scan'

describe('visual evidence resource ownership', () => {
  let cancel: AbortController
  let images: { mobile: Buffer; desktop: Buffer }
  const pending: Promise<void>[] = []
  beforeEach(async () => {
    vi.clearAllMocks()
    cancel = new AbortController()
    images = { mobile: await sharp({ create: { width: 10, height: 20, channels: 3, background: '#123456' } }).png().toBuffer(),
      desktop: await sharp({ create: { width: 20, height: 10, channels: 3, background: '#abcdef' } }).png().toBuffer() }
    boundary.save.mockResolvedValue({})
    boundary.upload.mockResolvedValue('https://storage.example.test/evidence.png')
    boundary.compose.mockImplementation(async (left: Buffer, right: Buffer) => Buffer.concat([left, right]))
  })
  afterEach(async () => { cancel.abort(); await Promise.allSettled(pending.splice(0)) })

  function admission(capacity: number) {
    const pool = new BoundedSemaphore(capacity)
    let peak = 0
    boundary.admit.mockImplementation(async (_browser, _url, options) => {
      const release = await pool.acquire(cancel.signal)
      peak = Math.max(peak, pool.running)
      const device = options.profile.width < 500 ? 'mobile' : 'desktop'
      const close = vi.fn(async () => release())
      const page = { screenshot: vi.fn(async () => images[device]), url: () => _url,
        context: () => ({ close }), close: vi.fn(async () => {}) }
      return { page }
    })
    return { pool, peak: () => peak }
  }

  it.each([1, 2])('completes concurrent device comparisons with %s physical context slots', async capacity => {
    const resource = admission(capacity)
    for (const id of ['first', 'second']) pending.push(tryCaptureVisualEvidenceForAudit(id, 'https://example.test/' + id,
      [{ checkId: 'viewport-missing', severity: 'IMPORTANT', rubric: 'REACH' },
        { checkId: 'viewport-missing', severity: 'IMPORTANT', rubric: 'REACH' }]))
    await vi.waitFor(() => expect(boundary.save).toHaveBeenCalledTimes(2), { timeout: 200, interval: 5 })
    await Promise.all(pending)
    expect(resource.pool.running).toBe(0)
    expect(resource.pool.queued).toBe(0)
    expect(resource.peak()).toBeLessThanOrEqual(capacity)
    expect(boundary.admit).toHaveBeenCalledTimes(4)
    expect(boundary.compose).toHaveBeenCalledTimes(2)
    for (const [left, right, labels] of boundary.compose.mock.calls) {
      expect(left).toEqual(images.desktop)
      expect(right).toEqual(images.mobile)
      expect(labels).toMatchObject({ leftLabel: 'Desktop', rightLabel: 'Mobile' })
    }
  })

  it('opens only the device needed by the selected findings', async () => {
    admission(1)
    await tryCaptureVisualEvidenceForAudit('desktop', 'https://example.test/',
      [{ checkId: 'perf-score-poor', severity: 'IMPORTANT', rubric: 'EXPERIENCE' }], { perfScore: 60 })
    expect(boundary.admit).toHaveBeenCalledTimes(1)
    expect(boundary.admit.mock.calls[0][2].profile.width).toBeGreaterThan(500)
    expect(boundary.save).toHaveBeenCalledOnce()
  })

  it('does not open a comparison after its parent deadline expires', async () => {
    admission(1)
    await tryCaptureVisualEvidenceForAudit('expired', 'https://example.test/',
      [{ checkId: 'viewport-missing', severity: 'IMPORTANT', rubric: 'REACH' }], undefined, Date.now() - 1)
    expect(boundary.admit).not.toHaveBeenCalled()
    expect(boundary.save).not.toHaveBeenCalled()
  })

  it('does not manufacture a device comparison when one device is unavailable', async () => {
    const resource = admission(1)
    const admitted = boundary.admit.getMockImplementation()!
    boundary.admit.mockImplementation((...args) => args[2].profile.width < 500 ? Promise.reject(new Error('Mobile unavailable')) : admitted(...args))
    await tryCaptureVisualEvidenceForAudit('partial', 'https://example.test/',
      [{ checkId: 'viewport-missing', severity: 'IMPORTANT', rubric: 'REACH' },
        { checkId: 'perf-score-poor', severity: 'IMPORTANT', rubric: 'EXPERIENCE' }])
    expect(boundary.compose).not.toHaveBeenCalled()
    expect(boundary.save.mock.calls[0][0].data.performanceData.flagVisualEvidence).toEqual({ 'perf-score-poor': expect.objectContaining({ device: 'desktop' }) })
    expect(resource.pool.running).toBe(0)
  })

  const flowKey = 'flow-' + 'a'.repeat(32)
  const flow = (source = '/api/screenshots/recorded/desktop?page=' + flowKey + '-flow-0',
    destination = '/api/screenshots/recorded/desktop?page=' + flowKey + '-flow-1'): FlowScanResult => ({
    status: 'error_response', finalUrl: 'https://example.test/destination', steps: [
      { label: 'Landing', url: 'https://example.test/', screenshotUrl: source },
      { label: 'After click', url: 'https://example.test/destination', screenshotUrl: destination },
    ],
  })
  const failedFlow = [{ checkId: 'flow-cta-404', severity: 'IMPORTANT', rubric: 'EXPERIENCE' }]
  it.each([undefined, '/api/screenshots/recorded/desktop'])('composes recorded flow states with source %s without reopening the website', async source => {
    admission(1)
    boundary.read.mockImplementation(async (_id, _device, key: string | null) => key === null || key.endsWith('-flow-0') ? images.desktop : images.mobile)
    const observed = flow(source)
    await tryCaptureVisualEvidenceForAudit('recorded', 'https://example.test/', failedFlow, undefined, Date.now() + 5000, [observed])
    expect(boundary.admit).not.toHaveBeenCalled()
    expect(boundary.read.mock.calls.map(call => call.slice(0, 3))).toEqual([
      ['recorded', 'desktop', source ? null : flowKey + '-flow-0'], ['recorded', 'desktop', flowKey + '-flow-1'],
    ])
    expect(boundary.compose).toHaveBeenCalledWith(images.desktop, images.mobile, { leftLabel: 'Source', rightLabel: 'Destination' })
    expect(boundary.save).toHaveBeenCalledOnce()
    expect(boundary.save.mock.calls[0][0].data.performanceData.flagVisualEvidence['flow-cta-404'].sourceFrames)
      .toEqual({ source: observed.steps[0].screenshotUrl, destination: observed.steps[1].screenshotUrl })
  })

  it.each([
    ['/api/screenshots/another-audit/desktop?page=' + flowKey + '-flow-0', undefined],
    ['https://foreign.example/api/screenshots/recorded/desktop?page=' + flowKey + '-flow-0', undefined],
    ['/api/screenshots/recorded/desktop?page=../private', undefined],
    [undefined, '/api/screenshots/recorded/desktop?page=flow-1'],
    [undefined, '/api/screenshots/recorded/desktop?page=' + flowKey + '-flow-1&page=other'],
    [undefined, '/api/screenshots/recorded/mobile?page=' + flowKey + '-flow-1'],
    [undefined, '/api/screenshots/recorded/desktop?page=' + flowKey + '-flow-0'],
    [undefined, '/api/screenshots/recorded/desktop?page=flow-' + 'b'.repeat(32) + '-flow-1'],
  ])('does not reconstruct a flow comparison from unqualified references: %s', async (source, destination) => {
    admission(1)
    await tryCaptureVisualEvidenceForAudit('recorded', 'https://example.test/', failedFlow, undefined, Date.now() + 5000, [flow(source, destination)])
    expect(boundary.admit).not.toHaveBeenCalled()
    expect(boundary.read).not.toHaveBeenCalled()
    expect(boundary.save).not.toHaveBeenCalled()
  })

  it('keeps a recorded comparison unavailable when either original image is missing', async () => {
    admission(1)
    boundary.read.mockResolvedValue(null)
    await tryCaptureVisualEvidenceForAudit('recorded', 'https://example.test/', failedFlow, undefined, Date.now() + 5000, [flow()])
    expect(boundary.read).toHaveBeenCalledTimes(2)
    expect(boundary.admit).not.toHaveBeenCalled()
    expect(boundary.compose).not.toHaveBeenCalled()
    expect(boundary.save).not.toHaveBeenCalled()
  })
})
