// @vitest-environment jsdom
import assert from 'node:assert/strict'
import { describe, it, vi, beforeEach, afterEach } from 'vitest'
import type { Page } from 'playwright'

vi.mock('@/lib/utils/sleep', () => ({
  sleep: vi.fn(async () => {}),
}))

import { restoreDesktopCaptureViewport } from '../nav-probes'
import { probeFormValidation } from '../form-probes'
import { probeGhostSections } from '../scroll-probes'
import { measurePostClickLoading } from '../post-click-probes'

const styleOverrides = new Map<Element, Record<string, string>>()

function setStyle(el: Element, overrides: Record<string, string>): void {
  styleOverrides.set(el, overrides)
}

function setRect(el: Element, rect: { top?: number; width?: number; height?: number }): void {
  ;(el as Element & { getBoundingClientRect(): DOMRect }).getBoundingClientRect = () =>
    ({
      x: 0,
      y: rect.top ?? 0,
      top: rect.top ?? 0,
      left: 0,
      right: rect.width ?? 0,
      bottom: (rect.top ?? 0) + (rect.height ?? 0),
      width: rect.width ?? 0,
      height: rect.height ?? 0,
      toJSON: () => ({}),
    }) as DOMRect
}

function stubComputedStyle(): void {
  vi.stubGlobal('getComputedStyle', (el: Element) => ({
    fontFamily: '',
    fontSize: '16px',
    borderRadius: '0px',
    visibility: 'visible',
    display: 'block',
    opacity: '1',
    animationName: 'none',
    animationDuration: '0s',
    animationIterationCount: '1',
    transform: 'none',
    ...(styleOverrides.get(el) ?? {}),
  }))
}

interface PageMockOptions {
  evaluateQueue?: unknown[]
  queueStart?: number
  url?: string
  clickError?: Error
  navigationStatus?: number | null
  viewportSize?: { width: number; height: number } | null
  closed?: boolean
  queryResult?: unknown
}

function makePage(opts: PageMockOptions = {}): Page {
  let evaluateCalls = 0
  const evaluate = vi.fn(async (fn: (...args: unknown[]) => unknown, arg?: unknown) => {
    const queue = opts.evaluateQueue ?? []
    if (evaluateCalls >= (opts.queueStart ?? 0) && queue.length > 0) {
      evaluateCalls++
      return queue.shift()
    }
    evaluateCalls++
    return arg !== undefined ? fn(arg) : fn()
  })
  return {
    evaluate,
    url: vi.fn(() => opts.url ?? 'https://example.com/'),
    click: vi.fn(async () => {
      if (opts.clickError) throw opts.clickError
    }),
    waitForNavigation: vi.fn(async () => ({
      status: () => opts.navigationStatus ?? 200,
    })),
    waitForTimeout: vi.fn(async () => {}),
    setViewportSize: vi.fn(async () => {}),
    viewportSize: vi.fn(() => opts.viewportSize ?? { width: 390, height: 844 }),
    isClosed: vi.fn(() => opts.closed ?? false),
    $: vi.fn(async () => opts.queryResult ?? null),
  } as unknown as Page
}

describe('restoreDesktopCaptureViewport', () => {
  it('restores the desktop viewport size and scroll position', async () => {
    const page = makePage()
    await restoreDesktopCaptureViewport(page)
    expect(page.setViewportSize).toHaveBeenCalled()
    expect(page.evaluate).toHaveBeenCalled()
  })

  it('returns early on a closed page', async () => {
    const page = makePage({ closed: true })
    await restoreDesktopCaptureViewport(page)
    expect(page.setViewportSize).not.toHaveBeenCalled()
  })

  it('tolerates failures', async () => {
    const page = makePage()
    ;(page.setViewportSize as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('closed'))
    await restoreDesktopCaptureViewport(page)
  })
})

describe('probeFormValidation', () => {
  let restoreRect: () => void
  beforeEach(() => {
    document.body.innerHTML = ''
    styleOverrides.clear()
    stubComputedStyle()
    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
      return { width: this.closest('[hidden]') ? 0 : 300, height: 40 } as DOMRect
    })
    restoreRect = () => rectSpy.mockRestore()
  })
  afterEach(() => { restoreRect(); vi.unstubAllGlobals() })

  it('skips when there is no conversion form', async () => {
    document.body.innerHTML = '<main><p>No form here</p></main>'
    assert.equal((await probeFormValidation(makePage())).formValidation, 'skipped')
  })
  it('reports the actual native constraint observation for empty required fields', async () => {
    document.body.innerHTML = '<main><form><input name="email" type="email" required><button type="submit">Subscribe</button></form></main>'
    const result = await probeFormValidation(makePage())
    assert.equal(result.formValidation, 'ok')
    // Constraint inspection does not measure a feedback event.
    assert.equal(result.feedbackMs, null)
    assert.equal(result.evidence?.reason, 'native_validation')
  })
  it('skips forms without required fields', async () => {
    document.body.innerHTML = '<main><form><input name="email" type="email"><button type="submit">Subscribe</button></form></main>'
    assert.equal((await probeFormValidation(makePage())).formValidation, 'skipped')
  })
  it('records a missing submit control without claiming an attempted submission', async () => {
    document.body.innerHTML = '<main><form aria-label="Subscribe"><input name="email" type="email" required></form></main>'
    const result = await probeFormValidation(makePage())
    assert.equal(result.formValidation, 'broken')
    assert.equal(result.evidence?.reason, 'missing_submit')
    assert.equal(result.formLabel, 'Subscribe')
  })
  it('never submits prefilled values or stores them as observation evidence', async () => {
    document.body.innerHTML = '<main><form><input name="email" type="email" required value="PRIVATE@example.test"><button type="submit">Subscribe</button></form></main>'
    const click = vi.fn()
    const result = await probeFormValidation(makePage({ queryResult: { click } }))
    assert.equal(result.formValidation, 'skipped')
    assert.equal(result.evidence?.reason, 'prefilled_fields')
    assert.equal(click.mock.calls.length, 0)
    assert.equal(JSON.stringify(result).includes('PRIVATE@example.test'), false)
  })
  it('requires new feedback instead of passing an existing error message', async () => {
    document.body.innerHTML = '<main><form><input name="email" aria-required="true"><button type="submit">Subscribe</button><p role="alert">Existing error</p></form></main>'
    const click = vi.fn()
    const result = await probeFormValidation(makePage({ queryResult: { click } }))
    assert.equal(result.evidence?.reason, 'preexisting_feedback')
    assert.equal(click.mock.calls.length, 0)
  })
  it('keeps an interrupted click unknown rather than blaming form validation', async () => {
    document.body.innerHTML = '<main><form><input name="email" aria-required="true"><button type="submit">Subscribe</button></form></main>'
    const result = await probeFormValidation(makePage({ queryResult: { click: vi.fn(async () => { throw new Error('Browser closed') }) } }))
    assert.equal(result.formValidation, 'skipped')
    assert.equal(result.evidence?.reason, 'execution_interrupted')
  })
  it('does not borrow native validation from an invisible form', async () => {
    document.body.innerHTML = '<main><form hidden><input required><button>Hidden</button></form><form id="visible"><input name="email" required><button>Subscribe</button></form></main>'
    const result = await probeFormValidation(makePage())
    assert.equal(result.formLabel, 'Subscribe')
    assert.equal(result.evidence?.reason, 'native_validation')
  })
  it('can inspect empty required fields while optional controls retain their defaults', async () => {
    document.body.innerHTML = '<main><form><input name="email" required><input name="range" type="range" value="50"><button>Subscribe</button></form></main>'
    assert.equal((await probeFormValidation(makePage())).evidence?.reason, 'native_validation')
  })
})

describe('probeGhostSections', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    styleOverrides.clear()
    stubComputedStyle()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports ghost sections that stay invisible after scroll', async () => {
    document.body.innerHTML =
      '<main><section id="real">Real content</section><section id="ghost">Hidden section</section></main>'
    const ghost = document.querySelector('#ghost') as Element
    const real = document.querySelector('#real') as Element
    setRect(ghost, { top: 100, width: 390, height: 200 })
    setRect(real, { top: 0, width: 390, height: 200 })
    setStyle(ghost, { opacity: '0.05' })

    const result = await probeGhostSections(makePage())
    assert.equal(result.ghostCount, 1)
    assert.equal(result.sampleSelector, '#ghost')
    assert.equal(result.sampleText, 'Hidden section')
  })

  it('deduplicates the same ghost across scroll stops', async () => {
    document.body.innerHTML =
      '<main><section id="ghost">Hidden</section></main>'
    const ghost = document.querySelector('#ghost') as Element
    setRect(ghost, { top: 100, width: 390, height: 200 })
    setStyle(ghost, { opacity: '0' })

    const result = await probeGhostSections(makePage())
    assert.equal(result.ghostCount, 1)
  })

  it('returns zero ghosts on a clean page', async () => {
    document.body.innerHTML = '<main><section>Visible section</section></main>'
    const section = document.querySelector('section') as Element
    setRect(section, { top: 0, width: 390, height: 200 })

    const result = await probeGhostSections(makePage())
    assert.equal(result.ghostCount, 0)
    assert.equal(result.sampleSelector, null)
  })

  it('uses a default viewport height when the page reports none', async () => {
    document.body.innerHTML = '<main><section id="ghost">Hidden</section></main>'
    const ghost = document.querySelector('#ghost') as Element
    setRect(ghost, { top: 100, width: 390, height: 200 })
    setStyle(ghost, { opacity: '0' })

    const result = await probeGhostSections(makePage({ viewportSize: null }))
    assert.equal(result.ghostCount, 1)
  })
})

describe('measurePostClickLoading', () => {
  const nowSpy = vi.spyOn(Date, 'now')

  beforeEach(() => {
    nowSpy.mockReset()
    nowSpy.mockReturnValue(0)
  })

  it('records content timing when content appears immediately', async () => {
    const page = makePage({
      evaluateQueue: [{ pageUrl: 'https://example.com/', content: true, contentComplete: true },
        { loadingVisible: false, loadingLabel: null }],
    })
    const metrics = await measurePostClickLoading(page, 100)
    assert.equal(metrics.timeToFirstContentMs, 0)
    assert.equal(metrics.blankScreenMs, 0)
    assert.equal(metrics.stuckLoading, false)
  })

  it('flags a loading indicator that sticks for over two seconds', async () => {
    const page = makePage({
      evaluateQueue: [
        { pageUrl: 'https://example.com/', content: false, contentComplete: true }, { loadingVisible: true, loadingLabel: 'Loading spinner' },
        { pageUrl: 'https://example.com/', content: false, contentComplete: true }, { loadingVisible: true, loadingLabel: 'Loading spinner' },
        { pageUrl: 'https://example.com/', content: false, contentComplete: true }, { loadingVisible: true, loadingLabel: 'Loading spinner' },
        { pageUrl: 'https://example.com/', content: false, contentComplete: true }, { loadingVisible: true, loadingLabel: 'Loading spinner' },
      ],
    })
    // Advance the sampled clock without depending on the real polling interval.
    let elapsed = 0
    nowSpy.mockImplementation(() => {
      elapsed += 500
      return elapsed
    })
    const metrics = await measurePostClickLoading(page, 5000)
    assert.equal(metrics.stuckLoading, true)
    assert.equal(metrics.stuckLoadingLabel, 'Loading spinner')
  })

  it('keeps content arrival unknown when the observation cannot complete before its deadline', async () => {
    const page = makePage({
      evaluateQueue: [
        { pageUrl: 'https://example.com/', content: false, contentComplete: true }, { loadingVisible: false, loadingLabel: null },
      ],
    })
    let elapsed = 0
    nowSpy.mockImplementation(() => {
      elapsed += 2000
      return elapsed
    })
    const metrics = await measurePostClickLoading(page, 3000)
    assert.equal(metrics.timeToFirstContentMs, null)
    assert.equal(metrics.blankScreenMs, null)
    assert.equal(metrics.stuckLoading, null)
  })
})

import { expect } from 'vitest'
void expect
