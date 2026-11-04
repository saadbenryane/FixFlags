import { BILLING_ACTION_COPY } from '@/lib/marketing/copy-barrel'
import { fetchJsonWithDeadline } from '@/lib/api/client-request'
import { httpsDestinationReceipt } from '@/lib/api/https-destination'
import { z } from 'zod'

const waitlistReceipt = z.object({ ok: z.literal(true) })

export type CheckoutPlan = 'BUILDER' | 'TEAM'

export type CheckoutOutcome =
  | { kind: 'redirect'; url: string; existingSubscription: boolean }
  | { kind: 'paid-checkout-closed' }
  | { kind: 'unavailable'; message: string }
  | { kind: 'error'; message: string }
  | { kind: 'missing-destination' }

interface CheckoutResponse {
  url?: unknown
  code?: unknown
  message?: unknown
  error?: unknown
}

function messageFrom(data: CheckoutResponse): string | null {
  if (typeof data.message === 'string' && data.message.trim()) return data.message
  if (typeof data.error === 'string' && data.error.trim()) return data.error
  return null
}

export async function requestPlanCheckout(plan: CheckoutPlan, signal?: AbortSignal): Promise<CheckoutOutcome> {
  try {
    const { response, body } = await fetchJsonWithDeadline('/api/stripe/checkout', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    })
    const data = (body ?? {}) as CheckoutResponse

    if (data.code === 'PAID_CHECKOUT_CLOSED' || data.code === 'PRIVATE_BETA') {
      return { kind: 'paid-checkout-closed' }
    }

    const destination = httpsDestinationReceipt.safeParse(body)
    if (destination.success && (response.ok || response.status === 409)) {
      return {
        kind: 'redirect',
        url: destination.data.url,
        existingSubscription: response.status === 409,
      }
    }

    if (response.status === 503) {
      return {
        kind: 'unavailable',
        message: messageFrom(data) ?? BILLING_ACTION_COPY.checkout.unavailableBody,
      }
    }

    if (!response.ok) {
      return {
        kind: 'error',
        message: messageFrom(data) ?? BILLING_ACTION_COPY.checkout.failed,
      }
    }

    return { kind: 'missing-destination' }
  } catch {
    return { kind: 'error', message: BILLING_ACTION_COPY.checkout.failed }
  }
}

export type WaitlistJoinOutcome =
  | { kind: 'submitted' }
  | { kind: 'error'; message: string }

export async function submitWaitlistJoin(input: {
  email: string
  plan: CheckoutPlan
  source?: string
  campaign?: string
}, signal?: AbortSignal): Promise<WaitlistJoinOutcome> {
  try {
    const { response, body } = await fetchJsonWithDeadline('/api/stripe/waitlist', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: input.email,
        plan: input.plan,
        name: '',
        source: input.source,
        campaign: input.campaign,
      }),
    })
    if (response.ok && waitlistReceipt.safeParse(body).success) return { kind: 'submitted' }

    const data = (body ?? {}) as CheckoutResponse
    return {
      kind: 'error',
      message: messageFrom(data) ?? BILLING_ACTION_COPY.waitlist.failed,
    }
  } catch {
    return { kind: 'error', message: BILLING_ACTION_COPY.waitlist.failed }
  }
}
