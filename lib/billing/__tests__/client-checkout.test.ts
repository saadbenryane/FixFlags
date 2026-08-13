import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  requestPlanCheckout,
  submitWaitlistJoin,
} from '@/lib/billing/client-checkout'
import { BILLING_ACTION_COPY } from '@/lib/marketing/copy'

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

  it('returns unavailable for 503 status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'service unavailable' }), { status: 503 })
      )
    )

    await expect(requestPlanCheckout('BUILDER')).resolves.toEqual({
      kind: 'unavailable',
      message: 'service unavailable',
    })
  })

  it('returns unavailable with fallback message for 503 without body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({}), { status: 503 })
      )
    )

    await expect(requestPlanCheckout('BUILDER')).resolves.toEqual({
      kind: 'unavailable',
      message: BILLING_ACTION_COPY.checkout.unavailableBody,
    })
  })

  it('returns error for non-ok response without redirect url', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'bad request' }), { status: 400 })
      )
    )

    await expect(requestPlanCheckout('BUILDER')).resolves.toEqual({
      kind: 'error',
      message: 'bad request',
    })
  })

  it('returns error with fallback message for non-ok without body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({}), { status: 400 })
      )
    )

    await expect(requestPlanCheckout('BUILDER')).resolves.toEqual({
      kind: 'error',
      message: BILLING_ACTION_COPY.checkout.failed,
    })
  })

  it('returns missing-destination when response ok but no url', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({}), { status: 200 })
      )
    )

    await expect(requestPlanCheckout('BUILDER')).resolves.toEqual({
      kind: 'missing-destination',
    })
  })

  it('handles PRIVATE_BETA code as paid-checkout-closed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: 'PRIVATE_BETA' }), { status: 403 })
      )
    )

    await expect(requestPlanCheckout('BUILDER')).resolves.toEqual({
      kind: 'paid-checkout-closed',
    })
  })
})

describe('submitWaitlistJoin', () => {
  it('submits the canonical waitlist payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      submitWaitlistJoin({ email: 'builder@example.com', plan: 'TEAM', source: 'pricing' })
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

  it('returns error for failed waitlist submission', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'waitlist full' }), { status: 400 })
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      submitWaitlistJoin({ email: 'builder@example.com', plan: 'BUILDER' })
    ).resolves.toEqual({ kind: 'error', message: 'waitlist full' })
  })

  it('returns error with fallback for failed waitlist without body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), { status: 500 })
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      submitWaitlistJoin({ email: 'builder@example.com', plan: 'BUILDER' })
    ).resolves.toEqual({ kind: 'error', message: BILLING_ACTION_COPY.waitlist.failed })
  })

  it('returns error on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))

    await expect(
      submitWaitlistJoin({ email: 'builder@example.com', plan: 'TEAM' })
    ).resolves.toEqual({ kind: 'error', message: BILLING_ACTION_COPY.waitlist.failed })
  })

  it('includes campaign and source in payload when provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await submitWaitlistJoin({
      email: 'test@example.com',
      plan: 'TEAM',
      source: 'pricing',
      campaign: 'summer_sale',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/stripe/waitlist',
      expect.objectContaining({
        body: JSON.stringify({
          email: 'test@example.com',
          plan: 'TEAM',
          name: '',
          source: 'pricing',
          campaign: 'summer_sale',
        }),
      })
    )
  })
})
