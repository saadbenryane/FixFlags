// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadingUiInDocument } from '../loading-ui'

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(1000)
  vi.stubGlobal('innerWidth', 390); vi.stubGlobal('innerHeight', 800)
  vi.stubGlobal('getComputedStyle', (element: HTMLElement) => ({ display: element.style.display || 'block',
    visibility: element.style.visibility || 'visible', opacity: element.style.opacity || '1' }))
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const data = (this as HTMLElement).dataset
    const left = Number(data.left ?? 0), top = Number(data.top ?? 0), width = Number(data.width ?? 200), height = Number(data.height ?? 150)
    return { left, right: left + width, top, bottom: top + height, width, height } as DOMRect
  })
  document.body.innerHTML = ''
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })

describe('shared blocking loading observation', () => {
  it('uses the loader computed visibility instead of rejecting an overridden ancestor value', () => {
    document.body.innerHTML = '<main style="visibility:hidden"><div class="spinner" style="visibility:visible"></div></main>'
    expect(loadingUiInDocument(false)).toMatchObject({ loadingVisible: true })
    expect(loadingUiInDocument(true)).toBe(false)
    document.querySelector<HTMLElement>('.spinner')!.style.visibility = 'hidden'
    expect(loadingUiInDocument(false)).toMatchObject({ loadingVisible: false })
    expect(loadingUiInDocument(true)).toBe(1000)
  })

  it('uses the same viewport predicate for the snapshot and browser clearance timestamp', () => {
    document.body.innerHTML = '<main><div class="hero-skeleton" aria-label="Loading content"></div></main><footer><div class="spinner" data-width="12" data-height="12"></div></footer>'
    expect(loadingUiInDocument(false)).toMatchObject({ loadingVisible: true, loadingLabel: 'Loading content' })
    expect(loadingUiInDocument(true)).toBe(false)
    document.querySelector<HTMLElement>('.hero-skeleton')!.style.display = 'none'
    expect(loadingUiInDocument(false)).toMatchObject({ loadingVisible: false })
    expect(loadingUiInDocument(true)).toBe(1000)
  })
  it('excludes offscreen loading UI, clipped overlays and transparent ancestors', () => {
    document.body.innerHTML = '<main><div class="skeleton" data-top="1000"></div><div style="opacity:0"><div class="spinner"></div></div></main>' +
      '<div class="loading" data-left="-200" data-width="200" data-height="800"></div>'
    expect(loadingUiInDocument(false)).toMatchObject({ loadingVisible: false })
  })
  it('recognizes a visible main loader and a large overlay while ignoring a false loading attribute', () => {
    document.body.innerHTML = '<main><div data-loading="false"></div></main>'
    expect(loadingUiInDocument(false)).toMatchObject({ loadingVisible: false })
    document.querySelector('div')!.setAttribute('data-loading', 'true')
    expect(loadingUiInDocument(false)).toMatchObject({ loadingVisible: true })
    document.body.innerHTML = '<div aria-busy="true" data-width="390" data-height="400"></div>'
    expect(loadingUiInDocument(false)).toMatchObject({ loadingVisible: true })
  })
})
