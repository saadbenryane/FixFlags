import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProductAttentionImpression } from '@/components/product/ProductAttentionImpression'

let observerCallback: IntersectionObserverCallback | null = null
const disconnect = vi.fn()

class IntersectionObserverMock {
  constructor(callback: IntersectionObserverCallback) {
    observerCallback = callback
  }
  observe = vi.fn()
  disconnect = disconnect
  unobserve = vi.fn()
  takeRecords = vi.fn(() => [])
  root = null
  rootMargin = ''
  thresholds = [0.25]
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  observerCallback = null
})

describe('ProductAttentionImpression', () => {
  it('records once when the delivered Attention becomes visible', async () => {
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock)
    const onVisible = vi.fn().mockResolvedValue(undefined)
    render(
      <ProductAttentionImpression onVisible={onVisible}>
        <span>Attention now</span>
      </ProductAttentionImpression>,
    )

    expect(screen.getByText('Attention now')).toBeInTheDocument()
    await act(async () => {
      observerCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      )
      observerCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      )
    })
    expect(onVisible).toHaveBeenCalledTimes(1)
    expect(disconnect).toHaveBeenCalled()
  })

  it('retries a transient recording failure while Attention remains visible', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock)
    const onVisible = vi
      .fn()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce(undefined)
    render(
      <ProductAttentionImpression onVisible={onVisible}>
        <span>Attention now</span>
      </ProductAttentionImpression>,
    )

    await act(async () => {
      observerCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      )
      await Promise.resolve()
    })
    expect(onVisible).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000)
    })

    expect(onVisible).toHaveBeenCalledTimes(2)
    expect(disconnect).toHaveBeenCalled()
  })
})
