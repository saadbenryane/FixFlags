// @vitest-environment jsdom
import assert from 'node:assert/strict'
import { describe, it, vi, beforeEach, afterEach } from 'vitest'
import type { Page } from 'playwright'
import { measureMobileLayout, measureMotionA11y } from '../../capture-metrics'

type StyleOverrides = Partial<{
  fontFamily: string
  fontSize: string
  borderRadius: string
  visibility: string
  display: string
  opacity: string
  animationName: string
  animationDuration: string
  animationIterationCount: string
}>

const styleOverrides = new Map<Element, StyleOverrides>()

function setStyle(el: Element, overrides: StyleOverrides): void {
  styleOverrides.set(el, overrides)
}

function setRect(el: Element, rect: Partial<DOMRect>): void {
  ;(el as Element & { getBoundingClientRect(): DOMRect }).getBoundingClientRect = () =>
    ({
      x: 0,
      y: rect.top ?? 0,
      top: rect.top ?? 0,
      left: rect.left ?? 0,
      right: rect.width ?? 0,
      bottom: (rect.top ?? 0) + (rect.height ?? 0),
      width: rect.width ?? 0,
      height: rect.height ?? 0,
      toJSON: () => ({}),
    }) as DOMRect
}

const defaultStyle: StyleOverrides = {
  fontFamily: '',
  fontSize: '16px',
  borderRadius: '0px',
  visibility: 'visible',
  display: 'block',
  opacity: '1',
  animationName: 'none',
  animationDuration: '0s',
  animationIterationCount: '1',
}

function stubComputedStyle(): void {
  vi.stubGlobal('getComputedStyle', (el: Element) => ({
    ...defaultStyle,
    ...(styleOverrides.get(el) ?? {}),
  }))
}

function fakePage(emulateMediaImpl?: () => Promise<void>): Page {
  const evaluate = vi.fn(async (fn: () => unknown) => {
    return fn()
  })
  return {
    evaluate,
    emulateMedia: vi.fn(async (opts: { reducedMotion: string }) => {
      // Default: reduced-motion is honored, so animations disappear.
      if (emulateMediaImpl) return emulateMediaImpl()
      if (opts.reducedMotion === 'reduce') {
        document.querySelectorAll('*').forEach((el) => {
          const overrides = styleOverrides.get(el) ?? {}
          styleOverrides.set(el, { ...overrides, animationName: 'none' })
        })
      }
    }),
  } as unknown as Page
}

describe('measureMobileLayout', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    styleOverrides.clear()
    stubComputedStyle()
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports a primary CTA above the fold as the mobile primary CTA', async () => {
    document.body.innerHTML =
      '<main><a id="cta" href="/pricing">Pricing</a><a id="signup" href="/signup">Get started</a></main>'
    const cta = document.querySelector('#cta') as Element
    const signup = document.querySelector('#signup') as Element
    setRect(cta, { top: 120, width: 200, height: 48 })
    setRect(signup, { top: 180, width: 200, height: 48 })

    const metrics = await measureMobileLayout(fakePage())

    assert.equal(metrics.mobilePrimaryCtaTopPx, 120)
    assert.equal(metrics.mobilePrimaryCtaText, 'Pricing')
    assert.ok(metrics.competingPrimaryCtaCount >= 2)
  })

  it('prefers a hero search input over the generic topmost CTA', async () => {
    document.body.innerHTML =
      '<main><form><input id="search" type="search" placeholder="Search for a doctor"><button type="submit">Search</button></form><a id="cta" href="/pricing">Pricing</a></main>'
    const input = document.querySelector('#search') as Element
    const cta = document.querySelector('#cta') as Element
    setRect(input, { top: 300, width: 300, height: 44 })
    setRect(cta, { top: 100, width: 200, height: 48 })

    const metrics = await measureMobileLayout(fakePage())
    assert.equal(metrics.mobilePrimaryCtaText, 'Search')
    assert.equal(metrics.mobilePrimaryCtaTopPx, 300)
  })

  it('detects a stuck loading indicator and reports its label', async () => {
    document.body.innerHTML =
      '<main><div id="skeleton" class="skeleton-loader" aria-label="Loading reviews"></div></main>'
    const el = document.querySelector('#skeleton') as Element
    setRect(el, { top: 0, width: 390, height: 300 })

    const metrics = await measureMobileLayout(fakePage())
    assert.equal(metrics.stuckLoadingIndicator, true)
    assert.equal(metrics.stuckLoadingLabel, 'Loading reviews')
  })

  it('ignores hidden or zero-size loading elements', async () => {
    document.body.innerHTML =
      '<main><div id="hidden" class="spinner" style="display:none"></div></main>'
    const el = document.querySelector('#hidden') as Element
    setStyle(el, { display: 'none' })
    setRect(el, { top: 0, width: 390, height: 300 })

    const metrics = await measureMobileLayout(fakePage())
    assert.equal(metrics.stuckLoadingIndicator, false)
  })

  it('counts unique font families across main content', async () => {
    document.body.innerHTML =
      '<main><h1>Heading</h1><p>Body copy</p><button>Button</button></main>'
    for (const el of document.querySelectorAll('h1, p, button')) {
      setRect(el, { top: 10, width: 100, height: 20 })
      setStyle(el, { fontFamily: el.tagName === 'H1' ? 'Georgia' : 'Inter' })
    }

    const metrics = await measureMobileLayout(fakePage())
    assert.equal(metrics.uniqueFontFamilies, 2)
    assert.deepEqual(metrics.fontFamilySample, ['Georgia', 'Inter'])
  })

  it('records button border radii for CTA buttons', async () => {
    document.body.innerHTML = '<main><a id="cta" href="/pricing">Pricing</a></main>'
    const cta = document.querySelector('#cta') as Element
    setRect(cta, { top: 100, width: 200, height: 48 })
    setStyle(cta, { borderRadius: '8px' })

    const metrics = await measureMobileLayout(fakePage())
    assert.deepEqual(metrics.buttonBorderRadii, [8])
  })

  it('flags visible inputs with a font size below 16px', async () => {
    document.body.innerHTML =
      '<main><form><input id="email" type="email" name="email"></form></main>'
    const input = document.querySelector('#email') as Element
    setRect(input, { top: 200, width: 300, height: 40 })
    setStyle(input, { fontSize: '14px' })

    const metrics = await measureMobileLayout(fakePage())
    assert.deepEqual(metrics.inputsBelow16px, [{ selector: '#email', fontSize: 14 }])
  })

  it('reports absolute scroll position and document height', async () => {
    document.body.innerHTML = '<main><a id="cta" href="/pricing">Pricing</a></main>'
    const cta = document.querySelector('#cta') as Element
    setRect(cta, { top: 50, width: 200, height: 48 })
    Object.defineProperty(window, 'scrollY', { value: 400, configurable: true })

    const metrics = await measureMobileLayout(fakePage())
    assert.equal(metrics.mobileScrollY, 400)
    assert.equal(metrics.mobilePrimaryCtaTopPx, 450)
  })

  it('returns null CTA info when there are no CTAs on the page', async () => {
    document.body.innerHTML = '<main><p>Just some text with no links or buttons.</p></main>'
    const metrics = await measureMobileLayout(fakePage())
    assert.equal(metrics.mobilePrimaryCtaTopPx, null)
    assert.equal(metrics.mobilePrimaryCtaText, null)
    assert.equal(metrics.competingPrimaryCtaCount, 0)
    assert.equal(metrics.motionIgnoresReducedPreference, false)
  })
})

describe('measureMotionA11y', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    styleOverrides.clear()
    stubComputedStyle()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns clean when no significant motion exists', async () => {
    document.body.innerHTML = '<main><div id="static">Static content</div></main>'
    const el = document.querySelector('#static') as Element
    setRect(el, { top: 0, width: 100, height: 50 })

    const result = await measureMotionA11y(fakePage())
    assert.deepEqual(result, { motionIgnoresReducedPreference: false, motionSampleLabel: null })
  })

  it('reports ignored reduced-motion preference when animations persist', async () => {
    document.body.innerHTML = '<main><div id="anim" class="animate-fade">Animated</div></main>'
    const el = document.querySelector('#anim') as Element
    setRect(el, { top: 0, width: 100, height: 50 })
    setStyle(el, {
      animationName: 'fadeIn',
      animationDuration: '1s',
      animationIterationCount: 'infinite',
    })

    const result = await measureMotionA11y(fakePage(async () => {
      // reduced motion is ignored: animations stay
    }))
    assert.equal(result.motionIgnoresReducedPreference, true)
    assert.equal(result.motionSampleLabel, 'animate-fade')
  })

  it('is clean when reduced motion stops the animation', async () => {
    document.body.innerHTML = '<main><div id="anim">Animated</div></main>'
    const el = document.querySelector('#anim') as Element
    setRect(el, { top: 0, width: 100, height: 50 })
    setStyle(el, {
      animationName: 'fadeIn',
      animationDuration: '1s',
      animationIterationCount: 'infinite',
    })

    // fakePage's default emulateMedia clears animationName on 'reduce'
    const result = await measureMotionA11y(fakePage())
    assert.equal(result.motionIgnoresReducedPreference, false)
    assert.equal(result.motionSampleLabel, null)
  })

  it('degrades cleanly when emulateMedia throws', async () => {
    document.body.innerHTML = '<main><div id="anim">Animated</div></main>'
    const el = document.querySelector('#anim') as Element
    setRect(el, { top: 0, width: 100, height: 50 })
    setStyle(el, { animationName: 'fadeIn', animationDuration: '1s' })

    const result = await measureMotionA11y(fakePage(async () => {
      throw new Error('emulate failed')
    }))
    assert.equal(result.motionIgnoresReducedPreference, false)
    assert.equal(result.motionSampleLabel, null)
  })

  it('skips hidden animation elements', async () => {
    document.body.innerHTML = '<main><div id="anim" style="display:none">Animated</div></main>'
    const el = document.querySelector('#anim') as Element
    setRect(el, { top: 0, width: 100, height: 50 })
    setStyle(el, {
      animationName: 'fadeIn',
      animationDuration: '1s',
      display: 'none',
    })

    const result = await measureMotionA11y(fakePage())
    assert.equal(result.motionIgnoresReducedPreference, false)
  })
})
