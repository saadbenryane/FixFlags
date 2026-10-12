import { NextResponse } from 'next/server'
import { boundedText, verifyReceivingSignature, receivingEventSchema, acceptReceivingEmail } from '@/lib/sites/accounts/inbox'

export async function POST(request: Request) {
  const secret = process.env.RESEND_RECEIVING_WEBHOOK_SECRET
  if (!secret || !process.env.RESEND_API_KEY) return NextResponse.json({ error: 'Receiving unavailable' }, { status: 503 })
  let payload: string
  try { payload = await boundedText(request.body, 65_536) } catch { return NextResponse.json({ error: 'Invalid webhook' }, { status: 413 }) }
  if (!verifyReceivingSignature(payload, request.headers, secret)) return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  let raw: unknown
  try { raw = JSON.parse(payload) } catch { return NextResponse.json({ error: 'Invalid webhook' }, { status: 400 }) }
  const event = receivingEventSchema.safeParse(raw)
  if (!event.success) return NextResponse.json({ received: true })
  try { await acceptReceivingEmail(event.data) }
  catch { return NextResponse.json({ error: 'Receiving temporarily unavailable' }, { status: 503 }) }
  return NextResponse.json({ received: true })
}
