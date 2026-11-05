import { createElement } from 'react'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useTranscriptScroll } from './useTranscriptScroll'

type Observer = { callback: ResizeObserverCallback; disconnect: ReturnType<typeof vi.fn> }
let observers: Observer[]
let controls: ReturnType<typeof useTranscriptScroll>
function Panel({ content, enabled = true, threshold, scope }: { content: string; enabled?: boolean; threshold?: number; scope?: string }) {
  controls = useTranscriptScroll(content, { enabled, threshold, scope })
  return createElement('div', { ref: controls.transcriptRef, onScroll: controls.onScroll }, content)
}
beforeEach(() => {
  observers = []
  vi.stubGlobal('ResizeObserver', class {
    disconnect = vi.fn()
    constructor(callback: ResizeObserverCallback) { observers.push({ callback, disconnect: this.disconnect }) }
    observe() {}
  })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
function geometry(node: HTMLElement) {
  const state = { height: 300, content: 1000, offset: 700 }
  Object.defineProperties(node, {
    scrollHeight: { configurable: true, get: () => state.content },
    clientHeight: { configurable: true, get: () => state.height },
    scrollTop: { configurable: true, get: () => state.offset, set: (value: number) => { state.offset = Math.max(0, Math.min(value, state.content - state.height)) } },
  })
  return state
}
function resize(observer = observers.at(-1)!) { act(() => observer.callback([], {} as ResizeObserver)) }

it('keeps the latest reply in view when the composer or viewport changes size', () => {
  const rendered = render(createElement(Panel, { content: 'First reply' }))
  const node = rendered.container.firstElementChild as HTMLElement
  const state = geometry(node)
  fireEvent.scroll(node)
  state.height = 120
  resize()
  expect(node.scrollTop).toBe(880)
  state.height = 400
  resize()
  expect(node.scrollTop).toBe(600)
})

it('preserves earlier reading across replies and resize, then follows again when explicitly requested', () => {
  const rendered = render(createElement(Panel, { content: 'First reply' }))
  const node = rendered.container.firstElementChild as HTMLElement
  const state = geometry(node)
  node.scrollTop = 200; fireEvent.scroll(node)
  state.height = 120; state.content = 1400
  rendered.rerender(createElement(Panel, { content: 'A longer reply arrived' }))
  resize()
  expect(node.scrollTop).toBe(200)
  act(() => controls.followLatest())
  rendered.rerender(createElement(Panel, { content: 'The reader sent another message' }))
  expect(node.scrollTop).toBe(1280)
  node.scrollTop = 1280; fireEvent.scroll(node)
  state.height = 200
  resize()
  expect(node.scrollTop).toBe(1200)
})

it.each([60, 96])('retains the conversation-specific %i-pixel following threshold', threshold => {
  const rendered = render(createElement(Panel, { content: 'First reply', threshold }))
  const node = rendered.container.firstElementChild as HTMLElement
  const state = geometry(node)
  node.scrollTop = 620; fireEvent.scroll(node)
  state.height = 100
  resize()
  expect(node.scrollTop).toBe(threshold === 96 ? 900 : 620)
})

it('retires observers when disabled or closed without letting a late callback move the reader', () => {
  const rendered = render(createElement(Panel, { content: 'First reply' }))
  const node = rendered.container.firstElementChild as HTMLElement
  geometry(node)
  const previous = observers[0]
  rendered.rerender(createElement(Panel, { content: 'Normal support layout', enabled: false }))
  expect(previous.disconnect).toHaveBeenCalledOnce()
  node.scrollTop = 200; fireEvent.scroll(node)
  resize(previous)
  expect(node.scrollTop).toBe(200)
  rendered.rerender(createElement(Panel, { content: 'Compact support layout' }))
  expect(node.scrollTop).toBe(200)
  const current = observers.at(-1)!
  rendered.unmount()
  expect(current.disconnect).toHaveBeenCalledOnce()
})

it('starts a different conversation at its latest messages even when the message count is unchanged', () => {
  const rendered = render(createElement(Panel, { content: 'One recorded message', scope: 'first' }))
  const node = rendered.container.firstElementChild as HTMLElement
  geometry(node)
  node.scrollTop = 200; fireEvent.scroll(node)
  rendered.rerender(createElement(Panel, { content: 'One recorded message', scope: 'second' }))
  expect(node.scrollTop).toBe(700)
})

it('cannot follow a new conversation from an earlier conversation callback', () => {
  const rendered = render(createElement(Panel, { content: 'One recorded message', scope: 'first' }))
  const node = rendered.container.firstElementChild as HTMLElement
  geometry(node)
  const previousObserver = observers[0], previousFollow = controls.followLatest
  rendered.rerender(createElement(Panel, { content: 'One recorded message', scope: 'second' }))
  node.scrollTop = 200; fireEvent.scroll(node)
  act(() => previousFollow())
  resize(previousObserver)
  resize()
  expect(node.scrollTop).toBe(200)
  expect(previousObserver.disconnect).toHaveBeenCalledOnce()
})
