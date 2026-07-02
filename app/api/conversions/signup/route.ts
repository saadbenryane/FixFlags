import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sendMetaCapiEvent } from '@/lib/analytics/meta-capi'

const bodySchema = z.object({
  email: z.string().email().optional(),
  fbc: z.string().optional(),
  fbp: z.string().optional(),
  eventSourceUrl: z.string().url().optional(),
})

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const forwarded = req.headers.get('x-forwarded-for')
  const clientIp = forwarded?.split(',')[0]?.trim() ?? null
  const userAgent = req.headers.get('user-agent')

  const ok = await sendMetaCapiEvent({
    eventName: 'CompleteRegistration',
    email: parsed.data.email,
    fbc: parsed.data.fbc,
    fbp: parsed.data.fbp,
    eventSourceUrl: parsed.data.eventSourceUrl,
    clientIp,
    userAgent,
  })

  return NextResponse.json({ ok })
}
