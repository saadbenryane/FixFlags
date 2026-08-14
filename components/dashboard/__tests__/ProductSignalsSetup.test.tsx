import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProductSignalsSetup } from '@/components/dashboard/ProductSignalsSetup'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  })
})

describe('ProductSignalsSetup', () => {
  it('shows masked installation state and the privacy boundary', () => {
    render(
      <ProductSignalsSetup
        productId="product-1"
        productUrl="https://example.com"
        initialKeys={[{
          id: 'key-1',
          name: 'Browser snippet',
          prefix: 'ff_sig_abcd',
          lastFour: 'wxyz',
          allowedOrigin: 'https://example.com',
          lastUsedAt: null,
          createdAt: '2026-08-13T00:00:00.000Z',
        }]}
      />
    )

    expect(screen.getByText('ff_sig_abcd…wxyz')).toBeInTheDocument()
    expect(screen.getByText(/waiting for the first accepted observation/i)).toBeInTheDocument()
    expect(screen.getByText(/does not collect DOM text, input values, request bodies, or identity/i)).toBeInTheDocument()
    expect(screen.getByText(/expire.*30 days/i)).toBeInTheDocument()
  })

  it('shows a raw key only in the one-time creation snippet and can hide it', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'key-2',
        name: 'Browser snippet',
        prefix: 'ff_sig_new1',
        lastFour: 'tail',
        allowedOrigin: 'https://example.com',
        key: 'ff_sig_new1_secret_tail',
      }),
    })
    render(<ProductSignalsSetup productId="product-1" productUrl="https://example.com" />)

    fireEvent.click(screen.getByRole('button', { name: /add product context/i }))
    await screen.findByText(/ff_sig_new1_secret_tail/)
    expect(screen.getByText('ff_sig_new1…tail')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /hide one-time key/i }))
    expect(screen.queryByText(/ff_sig_new1_secret_tail/)).not.toBeInTheDocument()
    expect(screen.getByText('ff_sig_new1…tail')).toBeInTheDocument()
  })

  it('revokes a masked key and removes its local installation state', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true })
    render(
      <ProductSignalsSetup
        productId="product-1"
        productUrl="https://example.com"
        initialKeys={[{
          id: 'key-1',
          name: 'Browser snippet',
          prefix: 'ff_sig_abcd',
          lastFour: 'wxyz',
          allowedOrigin: 'https://example.com',
          lastUsedAt: '2026-08-13T00:00:00.000Z',
          createdAt: '2026-08-12T00:00:00.000Z',
        }]}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /revoke/i }))
    await waitFor(() => expect(screen.queryByText('ff_sig_abcd…wxyz')).not.toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/projects/product-1/signal-keys?keyId=key-1',
      { method: 'DELETE' }
    )
  })

  it('announces setup failures and relates them to the action', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Complete a Product Review first' }),
    })
    render(<ProductSignalsSetup productId="product-1" productUrl="https://example.com" />)

    const button = screen.getByRole('button', { name: /add product context/i })
    fireEvent.click(button)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Complete a Product Review first')
    expect(button).toHaveAttribute('aria-describedby', alert.id)
  })
})
