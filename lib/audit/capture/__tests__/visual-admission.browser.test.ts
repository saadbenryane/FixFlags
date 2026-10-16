import { createServer } from 'node:http'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import { browserCapacity } from '../../progressive/capacity'
import { closeBrowser, getAuditBrowser } from '../../screenshot'
import * as pageSessions from '../../browser/page-session'
import { runFlowScan } from '../../flow/run-flow-scan'
import { DESKTOP_CAPTURE_PROFILE } from '../../browser/capture-profile'
import { uploadScreenshot } from '@/lib/storage/screenshots'

const storage = vi.hoisted(() => ({ uploads: new Map<string, Buffer>(), updates: vi.fn() }))
vi.mock('@/lib/storage/screenshots', () => ({
  uploadScreenshot: async (id: string, device: string, image: Buffer, key: string) => {
    storage.uploads.set(id + ':' + key, image)
    return 'http://localhost:3000/api/screenshots/' + id + '/' + device + '?page=' + key
  },
  readScreenshot: async (id: string, _device: string, key: string) => storage.uploads.get(id + ':' + key) ?? null,
}))
vi.mock('@/lib/get-app-url', () => ({ getAppUrl: () => 'http://localhost:3000' }))
vi.mock('../../scan-access-store', () => ({ resolveAuditScanAccess: async () => null }))
vi.mock('../../execution-ownership', () => ({ currentExecutionOwnership: () => undefined,
  executionTransaction: async (write: (tx: unknown) => Promise<unknown>) => write({
    audit: { findUnique: async () => ({ performanceData: {} }), update: storage.updates },
  }),
}))
import { tryCaptureVisualEvidenceForAudit } from '../../persist-visual-evidence'

const native = process.env.KEYBOARD_BROWSER_REQUIRED === 'true' ? describe : describe.skip
native('native visual evidence admission', () => {
  let origin: string
  let peakContexts = 0
  const requests: string[] = []
  const server = createServer((request, response) => {
    const mobile = /Mobile|Android|iPhone/i.test(String(request.headers['user-agent']))
    const color = request.url === '/second' ? mobile ? '#663399' : '#33cc00' : mobile ? '#0066cc' : '#cc3300'
    if (request.url === '/first' || request.url === '/second' || request.url?.startsWith('/flow-')) requests.push(request.url + ':' + (mobile ? 'mobile' : 'desktop'))
    response.setHeader('content-type', 'text/html')
    if (request.url?.startsWith('/flow-')) {
      const destination = request.url.includes('destination'), other = request.url.includes('other')
      if (destination) response.statusCode = 404
      const background = other ? destination ? '#663399' : '#33cc00' : destination ? '#0066cc' : '#cc3300'
      response.end('<!doctype html><html><head><title>Flow fixture</title><style>html,body{margin:0;min-height:100vh;background:' +
        background + '}</style></head><body><main><h1>Useful product information</h1>' + (destination ? 'The destination is unavailable.' :
        '<a href="/flow-destination' + (other ? '-other' : '') + '">Get started</a>') + '</main></body></html>')
      return
    }
    response.end('<!doctype html><html><head><title>Responsive fixture</title><style>' +
      'html,body{margin:0;min-height:100vh;background:' + color + '}' +
      '</style></head><body><h1>Responsive fixture</h1></body></html>')
  })
  beforeAll(async () => {
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    origin = 'http://127.0.0.1:' + (server.address() as { port: number }).port
  })
  afterAll(async () => {
    await closeBrowser()
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  })
  it('reuses sequential device frames under contention and puts desktop pixels in the Desktop panel', async () => {
    const browser = await getAuditBrowser()
    const original = pageSessions.createAuditPage
    const session = vi.spyOn(pageSessions, 'createAuditPage').mockImplementation(async (owner, url, options) => {
      const opened = await original(owner, url, { ...options, allowLocalhost: true })
      peakContexts = Math.max(peakContexts, browser.contexts().length)
      return opened
    })
    // Leave one physical context slot available to two concurrent captures.
    const held = await Promise.all(Array.from({ length: browserCapacity.capacity - 1 }, () => browserCapacity.acquire()))
    try {
      await Promise.all(['first', 'second'].map(id => tryCaptureVisualEvidenceForAudit(id, origin + '/' + id,
        [{ checkId: 'viewport-missing', severity: 'IMPORTANT', rubric: 'REACH' }], undefined, Date.now() + 15_000)))
      expect(storage.updates).toHaveBeenCalledTimes(2)
      expect(session).toHaveBeenCalledTimes(4)
      expect(peakContexts).toBe(1)
      expect(browser.contexts()).toHaveLength(0)
      expect(requests.sort()).toEqual(['/first:desktop', '/first:mobile', '/second:desktop', '/second:mobile'])
      for (const id of ['first', 'second']) {
        const image = storage.uploads.get(id + ':visual-viewport-missing')!
        expect(image).toBeDefined()
        const pixels = await sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true })
        const color = (x: number) => [...pixels.data.subarray((100 * pixels.info.width + x) * 3, (100 * pixels.info.width + x) * 3 + 3)]
        expect(color(20)).toEqual(id === 'first' ? [204, 51, 0] : [51, 204, 0])
        expect(color(pixels.info.width - 20)).toEqual(id === 'first' ? [0, 102, 204] : [102, 51, 153])
      }
      expect(browserCapacity.running).toBe(held.length)
      expect(browserCapacity.queued).toBe(0)
    } finally { held.forEach(release => release()); session.mockRestore() }
  }, 30_000)

  it('retains distinct walk assets and composes the recorded source and failed destination after another walk', async () => {
    const browser = await getAuditBrowser()
    const flows = []
    for (const path of ['/flow-source', '/flow-source-other']) {
      const url = origin + path
      const session = await pageSessions.createAuditPage(browser, url, { profile: DESKTOP_CAPTURE_PROFILE,
        allowLocalhost: true, deadline: Date.now() + 15_000 })
      try {
        const landingStep = path === '/flow-source' ? { label: 'Landing', url,
          screenshotUrl: await uploadScreenshot('recorded-native', 'desktop', Buffer.from(await session.page.screenshot()), 'recorded-hero') } : undefined
        const flow = await runFlowScan(session.page, 'recorded-native', url, { pageKey: 'same-prefix', mode: 'primary',
          allowLocalhost: true, deadlineMs: 10_000, landingStep })
        expect(flow.status).toBe('error_response')
        expect(flow.steps).toHaveLength(2)
        flows.push(flow)
      } finally { await session.page.context().close() }
    }
    expect(new Set(flows.flatMap(flow => flow.steps.map(step => step.screenshotUrl))).size).toBe(4)
    const count = requests.length
    await tryCaptureVisualEvidenceForAudit('recorded-native', origin + '/flow-source',
      [{ checkId: 'flow-cta-404', severity: 'IMPORTANT', rubric: 'EXPERIENCE' }], undefined, Date.now() + 5000, [flows[0]])
    expect(requests).toHaveLength(count)
    expect(browser.contexts()).toHaveLength(0)
    const image = storage.uploads.get('recorded-native:visual-flow-cta-404')!
    expect(image).toBeDefined()
    const pixels = await sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    const color = (x: number) => [...pixels.data.subarray((100 * pixels.info.width + x) * 3, (100 * pixels.info.width + x) * 3 + 3)]
    expect(color(20)).toEqual([204, 51, 0])
    expect(color(pixels.info.width - 20)).toEqual([0, 102, 204])
    expect(storage.updates.mock.lastCall![0].data.performanceData.flagVisualEvidence['flow-cta-404'].sourceFrames)
      .toEqual({ source: flows[0].steps[0].screenshotUrl, destination: flows[0].steps[1].screenshotUrl })
  }, 40_000)
})
