import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { recordRateLimit, requestClientId } from '@/lib/security/rate-limit'
import { getOrCreateVisitorToken } from '@/lib/live-support/visitor-token'
import {
  IMPROVEMENT_REJECTION_REASONS,
} from '@/lib/improvements/rejection-reasons'
import { executeProductCommand } from '@/lib/products/application/commands'

const LEGACY_FEEDBACK_REASONS = [
  'incorrect',
  'intentional',
  'already_fixed',
  'low_priority',
  'duplicate',
] as const

const feedbackSchema = z.object({
  vote: z.number().min(-1).max(1),
  comment: z.string().max(500).optional(),
  reason: z.enum([...IMPROVEMENT_REJECTION_REASONS, ...LEGACY_FEEDBACK_REASONS]).optional(),
  dismiss: z.boolean().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: flagId } = await params

    const clientId = requestClientId(await headers())
    await recordRateLimit({ scope: 'flag-feedback', identifier: clientId, limit: 30, windowSeconds: 60 })

    const body = await req.json().catch(() => ({}))
    const parsed = feedbackSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('Choose a valid feedback value', 400, { code: 'INVALID_FEEDBACK' })
    }

    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
    const visitorToken = await getOrCreateVisitorToken()
    const feedback = await executeProductCommand({
      type: 'RECORD_FLAG_FEEDBACK',
      flagId,
      visitorToken,
      userId: session?.user?.id ?? null,
      ...parsed.data,
    })
    if (!feedback) return apiError('Flag not found', 404, { code: 'NOT_FOUND' })

    return NextResponse.json(feedback)
  } catch (error) {
    return handleRouteError(error, 'Could not save feedback')
  }
}
