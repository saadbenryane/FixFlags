import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { logger } from '@/lib/logger'
import { getStripe } from '@/lib/stripe'
import {
  processStripeWebhookEvent,
  StripeWebhookProcessError,
} from '@/lib/billing/stripe-webhook'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ message: 'Missing Stripe signature' }, { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ message: 'Stripe webhook not configured' }, { status: 500 })
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch {
    return NextResponse.json(
      { message: 'Webhook signature verification failed' },
      { status: 400 }
    )
  }

  try {
    return NextResponse.json(await processStripeWebhookEvent(event, rawBody))
  } catch (error) {
    if (error instanceof StripeWebhookProcessError) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }
    logger.error('Stripe webhook failed', {
      stripeEventId: event.id,
      stripeEventType: event.type,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ message: 'Webhook processing failed' }, { status: 500 })
  }
}
