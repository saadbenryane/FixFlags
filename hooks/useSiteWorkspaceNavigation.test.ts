import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useSiteWorkspaceNavigation } from './useSiteWorkspaceNavigation'

beforeEach(() => {
  window.history.replaceState(null, '', '/sites/site-a')
  document.body.innerHTML = '<main id="main-content" tabindex="-1"><h1 tabindex="-1">Site</h1></main><button>Return to Flag</button>'
  vi.stubGlobal('scrollTo', vi.fn())
})
afterEach(() => { cleanup(); document.body.innerHTML = ''; vi.unstubAllGlobals() })

it('preserves initial and dialog focus while history restores a Flag in another view', () => {
  const opener = document.querySelector('button')!
  opener.focus()
  const { result } = renderHook(() => useSiteWorkspaceNavigation('site-a', { viewMode: 'home', selectedCard: null, selectedFlag: null }))
  expect(document.activeElement).toBe(opener)
  act(() => result.current.selectCategory('search'))
  act(() => result.current.openFlag('flag-a'))
  expect(document.activeElement).toBe(opener)
  act(() => {
    window.history.replaceState(null, '', '/sites/site-a?view=pages&flag=flag-b')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  expect(result.current.viewMode).toBe('pages')
  expect(result.current.selectedFlag).toBe('flag-b')
  expect(document.activeElement).toBe(opener)
  act(() => {
    window.history.replaceState(null, '', '/sites/site-a?view=pages')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  expect(result.current.selectedFlag).toBeNull()
  expect(document.activeElement).toBe(opener)
  act(() => {
    window.history.replaceState(null, '', '/sites/site-a?category=search')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  expect(result.current.viewMode).toBe('home')
  expect(result.current.selectedCard).toBe('search')
  expect(document.activeElement).toBe(opener)
  expect(window.scrollTo).not.toHaveBeenCalled()
})

it('focuses the restored view without resetting its reading position', () => {
  const heading = document.querySelector('h1')!
  const focus = vi.spyOn(heading, 'focus')
  const { result } = renderHook(() => useSiteWorkspaceNavigation('site-a', { viewMode: 'home', selectedCard: null, selectedFlag: null }))
  act(() => {
    window.history.replaceState(null, '', '/sites/site-a?view=timeline#timeline')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  expect(result.current.viewMode).toBe('timeline')
  expect(document.activeElement).toBe(heading)
  expect(focus).toHaveBeenCalledWith({ preventScroll: true })
  expect(window.scrollTo).not.toHaveBeenCalled()
})
