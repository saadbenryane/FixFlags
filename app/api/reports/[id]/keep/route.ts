import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { getGatedAuditForRequest } from '@/lib/audit/fetch-audit'
import { recordRateLimit, requestClientId } from '@/lib/security/rate-limit'

const bodySchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const clientId = requestClientId(request.headers)
    const rate = await recordRateLimit({
      scope: 'report-keep',
      identifier: clientId,
      limit: 8,
      windowSeconds: 3600,
    })
    if (rate.exceeded) {
      return apiError('Too many attempts. Try again later.', 429, { code: 'RATE_LIMITED' })
    }

    const result = await getGatedAuditForRequest(id)
    if (result.kind === 'not_found') return apiError('Report not found', 404)
    if (result.kind === 'forbidden') {
      return apiError('You do not have access to this report', 403)
    }

    const parsed = bodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? 'Invalid email', 400, {
        code: 'INVALID_EMAIL',
      })
    }

    const email = parsed.data.email.toLowerCase()
    const source = `report-keep:${id}`.slice(0, 64)

    await prisma.newsletterSubscriber.upsert({
      where: { email },
      create: {
        email,
        status: 'CONFIRMED',
        source,
        confirmedAt: new Date(),
      },
      update: {
        status: 'CONFIRMED',
        source,
        confirmedAt: new Date(),
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleRouteError(error)
  }
}
