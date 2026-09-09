import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { resend } from '@/lib/email/client'
import { DEMO_EMAILS } from '@/lib/email/templates'
import { BRAND } from '@/lib/marketing/copy'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { recordRateLimit, requestClientId } from '@/lib/security/rate-limit'
import { logger } from '@/lib/logger'
import { planLabel } from '@/lib/billing/plans'

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? `${BRAND.name} <${BRAND.supportEmail}>`

const schema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(100),
  email: z.string().trim().email('Enter a valid work email'),
  website: z.string().trim().min(3, 'Enter a website').max(500),
  plan: z.enum(['BUILDER', 'TEAM']),
  siteCount: z.number().int().min(1).max(10_000).optional(),
  note: z.string().trim().max(2000).optional(),
  company: z.string().max(200).optional(),
})

function demoNotifyEmail(): string | undefined {
  return process.env.DEMO_NOTIFY_EMAIL || process.env.ADMIN_NOTIFICATION_EMAIL
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function normalizeWebsite(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    const url = new URL(candidate)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (!url.hostname.includes('.')) return null
    return url.toString()
  } catch {
    return null
  }
}

async function sendDemoEmails(input: {
  name: string
  email: string
  website: string
  plan: 'BUILDER' | 'TEAM'
  siteCount?: number | null
  note?: string | null
}): Promise<{ notified: boolean; confirmed: boolean }> {
  if (!resend) {
    logger.warn('RESEND_API_KEY not set; skipping demo request emails')
    return { notified: false, confirmed: false }
  }

  const planName = planLabel(input.plan)
  let notified = false
  let confirmed = false
  const notifyTo = demoNotifyEmail()

  if (notifyTo) {
    try {
      const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: notifyTo,
        subject: DEMO_EMAILS.notify.subject(planName),
        html: DEMO_EMAILS.notify.html({
          name: escapeHtml(input.name),
          email: escapeHtml(input.email),
          website: escapeHtml(input.website),
          planLabel: planName,
          siteCount: input.siteCount,
          note: input.note ? escapeHtml(input.note) : null,
        }),
      })
      if (error) throw new Error(error.message)
      notified = true
    } catch (error) {
      logger.warn('Could not send demo request notify email', error)
    }
  } else {
    logger.warn('DEMO_NOTIFY_EMAIL and ADMIN_NOTIFICATION_EMAIL unset; skipping demo notify')
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: input.email,
      subject: DEMO_EMAILS.confirm.subject,
      html: DEMO_EMAILS.confirm.html(escapeHtml(input.name), planName),
    })
    if (error) throw new Error(error.message)
    confirmed = true
  } catch (error) {
    logger.warn('Could not send demo request confirmation email', error)
  }

  return { notified, confirmed }
}

export async function POST(request: Request) {
  try {
    const clientId = requestClientId(request.headers)
    const rate = await recordRateLimit({
      scope: 'demo_request',
      identifier: clientId,
      limit: 5,
      windowSeconds: 3600,
    })
    if (rate.exceeded) {
      return apiError('Too many attempts. Try again later.', 429, { code: 'RATE_LIMITED' })
    }

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? 'Invalid request', 400, {
        code: 'INVALID_DEMO_REQUEST',
      })
    }

    if (parsed.data.company?.trim()) {
      return NextResponse.json({ ok: true })
    }

    const website = normalizeWebsite(parsed.data.website)
    if (!website) {
      return apiError('Enter a valid website', 400, { code: 'INVALID_WEBSITE' })
    }

    const email = parsed.data.email.toLowerCase()
    const siteCount = parsed.data.plan === 'TEAM' ? parsed.data.siteCount ?? null : null
    const note = parsed.data.note?.trim() ? parsed.data.note.trim() : null

    await prisma.demoRequest.create({
      data: {
        name: parsed.data.name,
        email,
        website,
        plan: parsed.data.plan,
        siteCount,
        note,
      },
    })

    const emailed = await sendDemoEmails({
      name: parsed.data.name,
      email,
      website,
      plan: parsed.data.plan,
      siteCount,
      note,
    })

    return NextResponse.json({
      ok: true,
      emailed: emailed.notified || emailed.confirmed,
    })
  } catch (error) {
    return handleRouteError(error, 'Could not send the request. Try again.')
  }
}
