import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProductWatchControls } from '@/components/audit/ProductWatchControls'

const fetchMock = vi.fn()

const watchState = {
  watchInterval: 'weekly' as const,
  watchNextRunAt: '2026-08-20T12:00:00.000Z',
  watchLastRunAt: '2026-08-13T12:00:00.000Z',
  watchLastAttemptAt: '2026-08-13T12:00:00.000Z',
  watchConsecutiveFailures: 0,
  watchLastError: null,
  readiness: { available: true, error: null },
}

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, json: async () => watchState })
  vi.stubGlobal('fetch', fetchMock)
})

describe('ProductWatchControls', () => {
  it('renders the durable schedule immediately with 44px radio targets', async () => {
    render(
      <ProductWatchControls
        projectId="product-1"
        canWatch
        initialInterval="weekly"
        initialState={watchState}
      />
    )

    const weekly = screen.getByRole('radio', { name: /weekly/i })
    expect(weekly).toHaveAttribute('aria-checked', 'true')
    expect(weekly).toHaveClass('min-h-11', 'min-w-11')
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/projects/product-1/watch',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    ))
  })

  it('offers daily only when the Product has Studio access', () => {
    const { rerender } = render(
      <ProductWatchControls projectId="product-1" canWatch initialState={watchState} />
    )
    expect(screen.queryByRole('radio', { name: /daily/i })).not.toBeInTheDocument()

    rerender(
      <ProductWatchControls projectId="product-1" canWatch canDaily initialState={watchState} />
    )
    expect(screen.getByRole('radio', { name: /daily/i })).toBeInTheDocument()
  })

  it('persists a weekly schedule for an ordinary eligible Product', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...watchState, watchInterval: null }) })
      .mockResolvedValueOnce({ ok: true, json: async () => watchState })
    render(
      <ProductWatchControls
        projectId="product-1"
        canWatch
        initialState={{ ...watchState, watchInterval: null }}
      />
    )

    fireEvent.click(screen.getByRole('radio', { name: /weekly/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/projects/product-1/watch',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ interval: 'weekly' }),
      })
    ))
  })

  it('announces a failed state inline', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    render(<ProductWatchControls projectId="product-1" canWatch initialState={watchState} />)

    expect(await screen.findByRole('alert')).toHaveTextContent(/failed to load|could not load/i)
  })
})
