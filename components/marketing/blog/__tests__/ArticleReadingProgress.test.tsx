import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ArticleReadingProgress } from '../ArticleReadingProgress'

let article: HTMLElement
let height: number
let scroll: number
let frames: Map<number, FrameRequestCallback>
let frameId: number
let resize: ResizeObserverCallback
const observe = vi.fn()
const disconnect = vi.fn()
const originalScroll = Object.getOwnPropertyDescriptor(window, 'scrollY')
const originalHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight')

function flushFrame() {
  act(() => {
    const pending = [...frames.values()]
    frames.clear()
    for (const callback of pending) callback(0)
  })
}

function scrollTo(value: number) {
  scroll = value
  fireEvent.scroll(window)
  flushFrame()
}

describe('article reading progress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    scroll = 0
    height = 1200
    frames = new Map()
    frameId = 0
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scroll })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 600 })
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.set(++frameId, callback)
      return frameId
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)))
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) { resize = callback }
      observe = observe
      disconnect = disconnect
    })
    article = document.createElement('article')
    article.id = 'reading-content'
    article.getBoundingClientRect = () => ({ top: 1000 - scroll, height } as DOMRect)
    document.body.appendChild(article)
  })

  afterEach(() => {
    article.remove()
    if (originalScroll) Object.defineProperty(window, 'scrollY', originalScroll)
    if (originalHeight) Object.defineProperty(window, 'innerHeight', originalHeight)
    vi.unstubAllGlobals()
  })

  it('measures the article, clamps at its end, and follows scrolling back', () => {
    render(<ArticleReadingProgress articleId="reading-content" />)
    const bar = screen.getByRole('progressbar', { name: 'Article reading progress' })
    expect(bar).toHaveAttribute('aria-valuenow', '0')
    scrollTo(700)
    expect(bar).toHaveAttribute('aria-valuenow', '0')
    scrollTo(1300)
    expect(bar).toHaveAttribute('aria-valuenow', '50')
    expect(bar.firstChild).toHaveStyle({ transform: 'scaleX(0.5)' })
    scrollTo(1600)
    expect(bar).toHaveAttribute('aria-valuenow', '100')
    scrollTo(2600)
    expect(bar).toHaveAttribute('aria-valuenow', '100')
    scrollTo(1300)
    expect(bar).toHaveAttribute('aria-valuenow', '50')
  })

  it('recalculates when the viewport or article size changes', () => {
    render(<ArticleReadingProgress articleId="reading-content" />)
    scrollTo(1300)
    height = 1800
    act(() => resize([], {} as ResizeObserver))
    flushFrame()
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '25')
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1200 })
    fireEvent.resize(window)
    flushFrame()
    expect(bar).toHaveAttribute('aria-valuenow', '50')
    expect(observe).toHaveBeenCalledWith(article)
  })

  it('coalesces scroll events and cancels pending work on unmount', () => {
    const view = render(<ArticleReadingProgress articleId="reading-content" />)
    scroll = 1300
    fireEvent.scroll(window)
    fireEvent.scroll(window)
    expect(frames.size).toBe(1)
    view.unmount()
    expect(frames.size).toBe(0)
    expect(disconnect).toHaveBeenCalledOnce()
    fireEvent.scroll(window)
    expect(frames.size).toBe(0)
  })

  it('handles content shorter than the viewport and unmeasured content', () => {
    height = 200
    render(<ArticleReadingProgress articleId="reading-content" />)
    scrollTo(1000)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
    height = 0
    fireEvent.resize(window)
    flushFrame()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })
})
