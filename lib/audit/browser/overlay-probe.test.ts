// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Page } from 'playwright'
import { dismissConsentChrome, probeCoverAtPoint, severityForOverlayBlocker } from './overlay-probe'

function fixture(buttons: string) {
  document.body.innerHTML = `<a id="target">Openfair</a><div role="dialog" class="signal-consent-banner" style="position:fixed;z-index:60;opacity:1"><p>Analytics cookies on.</p>${buttons}</div>`
  const target = document.querySelector<HTMLElement>('#target')!
  const banner = document.querySelector<HTMLElement>('[role="dialog"]')!
  const controls = [...banner.querySelectorAll<HTMLElement>('button')]
  const bounds = (x: number, y: number, width: number, height: number) => DOMRect.fromRect({ x, y, width, height })
  target.getBoundingClientRect = () => bounds(0, 500, 300, 60)
  banner.getBoundingClientRect = () => bounds(0, 480, 350, 140)
  controls.forEach((button, index) => {
    button.style.opacity = '1'
    button.getBoundingClientRect = () => bounds(index * 120, 570, 110, 44)
  })
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: (x: number, y: number) =>
    y >= 570 ? controls[Math.floor(x / 120)] : banner })
  const page = { evaluate: async (fn: (arg: unknown) => unknown, arg: unknown) => fn(arg), waitForTimeout: vi.fn() } as unknown as Page
  return { page, controls }
}

afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks() })

describe('consent overlay classification', () => {
  it.each([
    ['Keep on', 'Turn off'], ['Allow analytics and ads', 'Turn off analytics'],
    ['Accept all', 'Necessary cookies only'], ['Allow', 'Use only essential'],
  ])('recognizes usable %s / %s choices without reporting a blocker', async (accept, reject) => {
    const { page } = fixture(`<button>${accept}</button><button>${reject}</button>`)
    const blocker = await probeCoverAtPoint(page, '#target', true)
    expect(blocker?.looksLikeConsentChrome).toBe(true)
    expect(severityForOverlayBlocker(blocker!)).toBeNull()
  })

  it.each(['hidden', 'disabled', 'style="display:none"', 'aria-disabled="true"'])('does not exempt an unusable reject choice: %s', async attributes => {
    const { page } = fixture(`<button>Keep on</button><button ${attributes}>Turn off</button>`)
    const blocker = await probeCoverAtPoint(page, '#target', true)
    expect(blocker?.looksLikeConsentChrome).toBe(false)
    expect(severityForOverlayBlocker(blocker!)).toBe('CRITICAL')
  })

  it('does not treat disagreement alone as acceptance', async () => {
    const { page } = fixture('<button>I disagree</button>')
    expect((await probeCoverAtPoint(page, '#target', true))?.looksLikeConsentChrome).toBe(false)
  })

  it('turns analytics off instead of accepting when both choices are offered', async () => {
    const { page, controls } = fixture('<button>Keep on</button><button>Turn off</button>')
    const accept = vi.spyOn(controls[0], 'click'), reject = vi.spyOn(controls[1], 'click')
    expect(await dismissConsentChrome(page)).toBe(true)
    expect(reject).toHaveBeenCalledOnce()
    expect(accept).not.toHaveBeenCalled()
  })
})
