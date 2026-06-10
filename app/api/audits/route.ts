import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuditQueue } from '@/lib/queue/client'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { checkRateLimit } from '@/lib/rate-limit'

const createSchema = z.object({
  url: z.string().url('Invalid URL — please include https://'),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const parsed = createSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid URL' },
      { status: 400 }
    )
  }

  let { url } = parsed.data

  // Block private/localhost URLs
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.endsWith('.local')
    ) {
      return NextResponse.json(
        { error: 'QualityOS can only audit publicly accessible URLs' },
        { status: 400 }
      )
    }
    // Normalize URL
    url = parsed.toString()
  } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
  }

  // Optional auth
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)

  // Check free tier limits for authenticated users
  if (session?.user) {
    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (user && user.auditsUsed >= user.auditsLimit) {
      return NextResponse.json(
        { error: 'Audit limit reached. Upgrade to continue.' },
        { status: 402 }
      )
    }
  } else {
    // Anonymous audits are limited per IP — each audit costs real compute
    const reqHeaders = await headers()
    const ip =
      reqHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      reqHeaders.get('x-real-ip') ||
      'unknown'
    const allowed = await checkRateLimit(`anon-audit:${ip}`, 3, 24 * 3600)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Free audit limit reached for today. Sign up to run more audits.' },
        { status: 429 }
      )
    }
  }

  // Create audit record
  const audit = await prisma.audit.create({
    data: {
      url,
      userId: session?.user?.id ?? null,
      status: 'QUEUED',
    },
  })

  // Increment usage counter
  if (session?.user) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { auditsUsed: { increment: 1 } },
    })
  }

  // Enqueue the job
  await getAuditQueue().add('audit', { auditId: audit.id }, { jobId: audit.id })

  return NextResponse.json({ auditId: audit.id, status: 'QUEUED' }, { status: 201 })
}
