import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSiteNavigationContinuity } from './useSiteNavigationContinuity'
import { SITE_CONTINUATION_PREFIX } from '@/lib/sites/navigation-continuity'

const key = SITE_CONTINUATION_PREFIX + '/sites/site-return'
beforeEach(() => {
  vi.useFakeTimers()
  sessionStorage.clear()
  window.history.replaceState({}, '', '/sites/site-return?category=accessibility')
  document.body.innerHTML = '<main id="main-content" tabindex="-1"><div role="dialog" data-state="open" data-site-return-context="category" tabindex="-1"><a data-site-return-focus="check" href="/sign-in?next=%2Fsites%2Fsite-return%3Fcategory%3Daccessibility">Sign in</a></div></main>'
  vi.stubGlobal('scrollTo', vi.fn())
  vi.stubGlobal('scrollY', 420)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(0), 16))
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); document.body.innerHTML = ''; window.history.replaceState({}, '', '/') })

function depart() {
  const mounted = renderHook(() => useSiteNavigationContinuity('site-return'))
  const link = document.querySelector('a')!
  link.addEventListener('click', event => event.preventDefault())
  document.querySelector<HTMLElement>('[role="dialog"]')!.scrollTop = 180
  act(() => { link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })) })
  mounted.unmount()
}
describe('Site authentication reading-position continuity', () => {
  it('restores the same category scroll and corresponding enabled action once', async () => {
    depart()
    const saved = JSON.parse(sessionStorage.getItem(key)!)
    expect(saved).toMatchObject({ y: 420, dialogTop: 180, focus: 'check' })
    expect(Object.keys(saved).sort()).toEqual(['destination', 'dialogTop', 'focus', 'recordedAt', 'version', 'x', 'y'])
    document.querySelector('[role="dialog"]')!.innerHTML = '<button data-site-return-focus="check">Check again</button>'
    renderHook(() => useSiteNavigationContinuity('owned-site'))
    await act(async () => { await vi.advanceTimersByTimeAsync(40) })
    expect(document.activeElement?.textContent).toBe('Check again')
    expect(document.querySelector<HTMLElement>('[role="dialog"]')!.scrollTop).toBe(180)
    expect(window.scrollTo).toHaveBeenCalledWith({ left: 0, top: 420, behavior: 'instant' })
    expect(sessionStorage.getItem(key)).toBeNull()
  })
  it('waits for asynchronously rendered category content without changing the destination', async () => {
    depart()
    document.querySelector('[role="dialog"]')!.remove()
    renderHook(() => useSiteNavigationContinuity('owned-site'))
    await act(async () => { await vi.advanceTimersByTimeAsync(40) })
    expect(window.scrollTo).not.toHaveBeenCalled()
    await act(async () => { document.querySelector('main')!.insertAdjacentHTML('beforeend', '<div role="dialog" data-state="open" data-site-return-context="category" tabindex="-1"><button data-site-return-focus="check">Check again</button></div>') })
    await act(async () => { await vi.advanceTimersByTimeAsync(40) })
    expect(document.activeElement?.textContent).toBe('Check again')
    expect(window.location.search).toBe('?category=accessibility')
  })
  it('does not move focus after the person starts another action while content is loading', async () => {
    depart()
    document.querySelector('[role="dialog"]')!.remove()
    renderHook(() => useSiteNavigationContinuity('owned-site'))
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })) })
    await act(async () => { await vi.advanceTimersByTimeAsync(6000) })
    expect(window.scrollTo).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(key)).toBeNull()
  })
  it('keeps a disabled successor inside its original dialog focus boundary', async () => {
    depart()
    document.querySelector('[role="dialog"]')!.innerHTML = '<button data-site-return-focus="check" disabled>Checking</button>'
    renderHook(() => useSiteNavigationContinuity('owned-site'))
    await act(async () => { await vi.advanceTimersByTimeAsync(40) })
    expect(document.activeElement).toBe(document.querySelector('[role="dialog"]'))
  })
  it('returns a workspace sign-in trigger to the visible account control after authentication', async () => {
    const link = document.querySelector<HTMLAnchorElement>('a')!
    link.dataset.siteReturnFocus = 'account'
    document.body.append(link)
    depart()
    expect(JSON.parse(sessionStorage.getItem(key)!)).toMatchObject({ dialogTop: null, focus: 'account' })
    link.remove()
    document.querySelector('[role="dialog"]')!.remove()
    const account = document.createElement('button')
    account.dataset.siteReturnFocus = 'account'
    account.textContent = 'Account menu'
    account.getClientRects = () => [{ width: 44, height: 44 }] as unknown as DOMRectList
    document.body.append(account)
    renderHook(() => useSiteNavigationContinuity('owned-site'))
    await act(async () => { await vi.advanceTimersByTimeAsync(40) })
    expect(document.activeElement).toBe(account)
    expect(sessionStorage.getItem(key)).toBeNull()
  })
  it('keeps the real authentication link usable when browser-local storage refuses writes', () => {
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Storage refused', 'SecurityError') })
    try {
      expect(() => depart()).not.toThrow()
      expect(document.querySelector('a')?.getAttribute('href')).toBe('/sign-in?next=%2Fsites%2Fsite-return%3Fcategory%3Daccessibility')
    } finally { write.mockRestore() }
  })
})
