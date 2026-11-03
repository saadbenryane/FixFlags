import { NextResponse } from 'next/server'
import { boundedText } from '@/lib/security/bounded-body'
import { verifySvixSignature } from '@/lib/security/svix'
import { acceptEmailProviderEvent } from '@/lib/email/delivery-events'

export async function POST(request: Request) {
  const secret = process.env.RESEND_DELIVERY_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'Delivery events unavailable' }, { status: 503 })
  let payload: string
  try { payload = await boundedText(request.body, 65_536) }
  catch { return NextResponse.json({ error: 'Invalid webhook' }, { status: 413 }) }
  if (!verifySvixSignature(payload, request.headers, secret)) return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  try { JSON.parse(payload) } catch { return NextResponse.json({ error: 'Invalid webhook' }, { status: 400 }) }
  try { await acceptEmailProviderEvent(request.headers.get('svix-id')!, payload) }
  catch { return NextResponse.json({ error: 'Delivery events temporarily unavailable' }, { status: 503 }) }
  return NextResponse.json({ received: true })
}
