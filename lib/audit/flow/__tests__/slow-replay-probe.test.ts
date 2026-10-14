// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Browser, Page } from 'playwright'
import { setTimeout as pause } from 'node:timers/promises'

const mocks = vi.hoisted(() => ({ session: vi.fn(), upload: vi.fn() }))
vi.mock('@/lib/audit/browser/page-session', () => ({ createAuditPage: mocks.session }))
vi.mock('@/lib/storage/screenshots', () => ({ uploadScreenshot: mocks.upload }))
vi.mock('node:timers/promises', () => { const timeout = (ms: number, _value: unknown, options?: { signal?: AbortSignal }) => new Promise<void>((resolve, reject) => {
  const signal = options?.signal
  if (signal?.aborted) return reject(new Error('Aborted'))
  const abort = () => { clearTimeout(timer); reject(new Error('Aborted')) }
  const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve() }, ms)
  signal?.addEventListener('abort', abort, { once: true })
}); return { setTimeout: timeout, default: { setTimeout: timeout } } })
import { observeSlowViewport, runSlowReplay } from '../slow-replay-probe'
import { SLOW_3G } from '../slow-replay-contract'
import { runSlowReplayChecks } from '../../checks/slow-replay'

const rect = (top = 0) => ({ width: 200, height: 50, top, bottom: top + 50, left: 0, right: 200 }) as DOMRect
function page() {
  const context = { close: vi.fn(async () => undefined), newCDPSession: vi.fn(async () => ({ send: vi.fn() })) }
  const captures: number[] = []
  const current = { evaluate: async (fn: (arg: unknown) => unknown, arg: unknown) => fn(arg), context: () => context, url: () => 'https://example.com/',
    screenshot: vi.fn(async () => { captures.push(Date.now()); return new Uint8Array([1]) }) } as unknown as Page
  return { current, context, captures }
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(0); vi.resetAllMocks()
  vi.spyOn(AbortSignal, 'timeout').mockImplementation(ms => {
    const controller = new AbortController(); setTimeout(() => controller.abort(new Error('Deadline')), ms); return controller.signal
  })
  vi.stubGlobal('CSS', { escape: (value: string) => value });
  vi.stubGlobal('innerWidth', 390); vi.stubGlobal('innerHeight', 844)
  vi.stubGlobal('getComputedStyle', (element: HTMLElement) => ({ display: element.style.display || 'block',
    visibility: element.style.visibility || 'visible', opacity: element.style.opacity || '1' }))
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
    return rect(Number((this as HTMLElement).dataset.top ?? 0))
  })
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', { configurable: true, value: function (this: Range) {
    return this.startContainer.parentElement?.getBoundingClientRect() ?? rect()
  } })
  document.body.innerHTML = '<main><p style="display:none">Meaningful product information for a visitor.</p><button style="display:none">Get started</button></main>'
  mocks.upload.mockImplementation(async (_audit, _device, _buffer, label) => 'https://example.com/' + label + '.png')
})
afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); delete (Range.prototype as { getBoundingClientRect?: unknown }).getBoundingClientRect })

describe('slow connection visitor observation', () => {
  it('captures the requested points while navigation is pending and records the actual observation horizon', async () => {
    const { current, context, captures } = page()
    const send = vi.fn()
    context.newCDPSession.mockResolvedValue({ send })
    mocks.session.mockImplementation(async (_browser, _url, options) => {
      await options.configurePage(current); options.onNavigationStart(current, Date.now())
      await pause(7000)
      return { page: current, disposeNetwork: vi.fn() }
    })
    setTimeout(() => { document.querySelector('p')!.style.display = 'block' }, 6000)
    setTimeout(() => { document.querySelector('button')!.style.display = 'block' }, 9000)
    const pending = runSlowReplay({} as Browser, 'audit', 'https://example.com/', { deadline: 20_000 })
    await vi.advanceTimersByTimeAsync(10_100)
    const result = await pending
    expect(send).toHaveBeenCalledWith('Network.emulateNetworkConditions', SLOW_3G)
    expect(captures).toEqual([2000, 5000, 8000])
    expect(result).toMatchObject({ navigationComplete: true, complete: true, timeToFirstTextMs: 6000, timeToCtaMs: 9000,
      observedForMs: 9000, textBlankThroughMs: 5900, ctaAbsentThroughMs: 8900 })
    expect(result.captures?.map(capture => capture.startedAtMs)).toEqual(captures)
    expect(context.close).toHaveBeenCalled()
  })
  it('does not count transparent, offscreen, or navigation-only content as visible', async () => {
    const { current } = page()
    document.body.innerHTML = '<header>Lots of navigation text for visitors.</header><main style="opacity:0"><p>Meaningful product information for a visitor.</p><button>Get started</button></main>'
    expect(await observeSlowViewport(current)).toMatchObject({ text: false, cta: false })
    document.querySelector('main')!.style.opacity = '1'
    document.querySelector('p')!.dataset.top = '-100'
    document.querySelector('button')!.dataset.top = '900'
    expect(await observeSlowViewport(current)).toMatchObject({ text: false, cta: false })
    document.querySelector('p')!.dataset.top = '0'; document.querySelector('button')!.dataset.top = '0'
    expect(await observeSlowViewport(current)).toMatchObject({ text: true, cta: true })
  })
  it('closes the page and cancels future captures when the deadline expires', async () => {
    const { current, context, captures } = page()
    mocks.session.mockImplementation(async (_browser, _url, options) => {
      options.onNavigationStart(current, Date.now()); await pause(5000)
      return { page: current, disposeNetwork: vi.fn() }
    })
    const pending = runSlowReplay({} as Browser, 'audit', 'https://example.com/', { deadline: 3000 })
    await vi.advanceTimersByTimeAsync(6000)
    expect(await pending).toMatchObject({ complete: false, reason: 'interrupted' })
    expect(context.close).toHaveBeenCalled()
    expect(captures).toEqual([2000])
    await vi.advanceTimersByTimeAsync(30_000)
    expect(captures).toEqual([2000])
  })
  it('counts a decoded main image as content and leaves opaque graphics unclassified', async () => {
    const { current } = page()
    document.body.innerHTML = '<main><img src="/hero.png" alt="Our product"></main>'
    const image = document.querySelector('img')!
    Object.defineProperties(image, { complete: { configurable: true, value: true }, naturalWidth: { value: 800 }, naturalHeight: { value: 600 } })
    vi.spyOn(image, 'getBoundingClientRect').mockReturnValue({ ...rect(), height: 200, bottom: 200 } as DOMRect)
    expect(await observeSlowViewport(current)).toMatchObject({ text: false, content: true })
    Object.defineProperty(image, 'complete', { value: false })
    expect(await observeSlowViewport(current)).toMatchObject({ content: false, contentComplete: true })
    document.querySelector('main')!.innerHTML = '<canvas></canvas>'
    vi.spyOn(document.querySelector('canvas')!, 'getBoundingClientRect').mockReturnValue({ ...rect(), height: 200, bottom: 200 } as DOMRect)
    expect(await observeSlowViewport(current)).toMatchObject({ content: false, contentComplete: false })
  })
  it('excludes navigation and loading messages even when the page has no main landmark', async () => {
    const { current } = page()
    document.body.innerHTML = '<header>Lots of navigation text for visitors.</header><div role="status">Please wait while your content loads.</div>'
    expect(await observeSlowViewport(current)).toMatchObject({ text: false, content: false })
  })
  it('keeps measuring the recorded action when a competing action appears early', async () => {
    const { current } = page()
    document.body.innerHTML = '<main><p>Meaningful product information for a visitor.</p><button id="original">Get started</button></main>'
    const expected = (await observeSlowViewport(current)).actions
    document.querySelector('button')!.style.display = 'none'
    document.querySelector('main')!.insertAdjacentHTML('beforeend', '<a href="/contact">Contact</a>')
    mocks.session.mockImplementation(async (_browser, _url, options) => {
      options.onNavigationStart(current, Date.now()); return { page: current, disposeNetwork: vi.fn() }
    })
    setTimeout(() => { document.querySelector('button')!.style.display = 'block' }, 9000)
    const pending = runSlowReplay({} as Browser, 'audit', 'https://example.com/', { deadline: 20_000, expectedActions: expected })
    await vi.advanceTimersByTimeAsync(10_100)
    const result = await pending
    expect(result.timeToCtaMs).toBe(0)
    expect(result.actions).toEqual(expect.arrayContaining([expect.objectContaining({ selector: '#original', timeToVisibleMs: 9000 })]))
    const findings = runSlowReplayChecks(result)
    expect(findings.map(flag => flag.checkId)).toEqual(['slow-3g-cta-delayed'])
    expect(findings[0].evidenceTargets).toEqual(expect.arrayContaining([expect.objectContaining({ selector: '#original' })]))
  })
})
