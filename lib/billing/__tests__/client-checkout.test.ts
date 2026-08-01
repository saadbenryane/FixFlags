import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  requestPlanCheckout,
  submitBetaInterest,
} from '@/lib/billing/client-checkout'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('requestPlanCheckout', () => {
  it('returns a redirect for a new checkout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ url: 'https://checkout.example/session' }), {
          status: 200,
        })
      )
    )

    await expect(requestPlanCheckout('BUILDER')).resolves.toEqual({
      kind: 'redirect',
      url: 'https://checkout.example/session',
      existingSubscription: false,
    })
  })

  it('distinguishes an existing subscription redirect', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ url: 'https://billing.example/portal' }), {
          status: 409,
        })
      )
    )

    await expect(requestPlanCheckout('TEAM')).resolves.toEqual({
      kind: 'redirect',
      url: 'https://billing.example/portal',
      existingSubscription: true,
    })
  })

  it('returns paid-checkout-closed without inventing a destination', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: 'PAID_CHECKOUT_CLOSED' }), { status: 403 })
      )
    )

    await expect(requestPlanCheckout('BUILDER')).resolves.toEqual({
      kind: 'paid-checkout-closed',
    })
  })

  it('returns a stable network failure message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    await expect(requestPlanCheckout('BUILDER')).resolves.toMatchObject({
      kind: 'error',
    })
  })
})

describe('submitBetaInterest', () => {
  it('submits the canonical beta-interest payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      submitBetaInterest({ email: 'builder@example.com', plan: 'TEAM', source: 'pricing' })
    ).resolves.toEqual({ kind: 'submitted' })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/stripe/waitlist',
      expect.objectContaining({
        body: JSON.stringify({
          email: 'builder@example.com',
          plan: 'TEAM',
          name: '',
          source: 'pricing',
          campaign: undefined,
        }),
      })
    )
  })
})
