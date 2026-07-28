import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FooterNewsletter } from '@/components/layout/FooterNewsletter'
import { LANDING_PAGE } from '@/lib/marketing/copy'

describe('FooterNewsletter', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the canonical validation message for an empty submission', () => {
    render(<FooterNewsletter />)

    fireEvent.click(screen.getByRole('button', { name: 'Subscribe' }))

    expect(
      screen.getByText(LANDING_PAGE.footer.newsletter.emailRequired)
    ).toBeInTheDocument()
  })

  it('submits a valid email and shows success', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'subscribed' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    render(<FooterNewsletter />)
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'builder@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Subscribe' }))

    await waitFor(() => {
      expect(
        screen.getByText(LANDING_PAGE.footer.newsletter.success)
      ).toBeInTheDocument()
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/newsletter/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'builder@example.com', source: 'footer' }),
    })
  })
})
