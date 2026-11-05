import { cleanup, renderHook } from '@testing-library/react'
import { createElement, StrictMode, type ReactNode } from 'react'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { useSiteDocumentTitle } from '../useSiteDocumentTitle'

beforeEach(() => { document.title = 'FixFlags' })
afterEach(() => cleanup())

it('updates the current workspace without changing its browser location', () => {
  const href = window.location.href
  const view = renderHook(({ title }) => useSiteDocumentTitle(title), { initialProps: { title: 'example.com · FixFlags' } })
  expect(document.title).toBe('example.com · FixFlags')
  view.rerender({ title: 'Pages · example.com · FixFlags' })
  expect(document.title).toBe('Pages · example.com · FixFlags')
  expect(window.location.href).toBe(href)
  view.unmount()
  expect(document.title).toBe('FixFlags')
})

it('does not replace metadata already published by the next route', () => {
  const view = renderHook(() => useSiteDocumentTitle('Pages · example.com · FixFlags'))
  document.title = 'Account settings · FixFlags'
  view.unmount()
  expect(document.title).toBe('Account settings · FixFlags')
})

it('retains and releases ownership during effect replay', () => {
  const view = renderHook(() => useSiteDocumentTitle('Checkout unavailable · shop.example · FixFlags'), {
    wrapper: ({ children }: { children: ReactNode }) => createElement(StrictMode, null, children),
  })
  expect(document.title).toBe('Checkout unavailable · shop.example · FixFlags')
  view.unmount()
  expect(document.title).toBe('FixFlags')
})
