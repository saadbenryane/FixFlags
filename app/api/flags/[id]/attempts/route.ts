import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { enforceRateLimit, requestClientId } from '@/lib/security/rate-limit'
import { recordFlagImprovementAttempt } from '@/lib/improvements/service'
import { IMPROVEMENT_REJECTION_REASONS } from '@/lib/improvements/rejection-reasons'

const schema = z.object({
  builder: z.string().trim().min(1).max(80),
  action: z.enum(['ACCEPT', 'HANDOFF_COPIED', 'READY_TO_VERIFY', 'REJECT']),
  changeSummary: z.string().trim().min(1).max(2_000).optional(),
  deploymentReference: z.string().trim().max(500).optional(),
  rejectionReason: z.enum(IMPROVEMENT_REJECTION_REASONS).optional(),
  rejectionNote: z.string().trim().max(500).optional(),
}).superRefine((value, context) => {
  if (value.action === 'READY_TO_VERIFY' && !value.changeSummary) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['changeSummary'],
      message: 'Describe the implemented change',
    })
  }
  if (value.action === 'REJECT' && !value.rejectionReason) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['rejectionReason'],
      message: 'Choose why this recommendation was rejected',
    })
  }
})

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const requestHeaders = await headers()
    const session = await auth.api.getSession({ headers: requestHeaders })
    if (!session?.user?.id) return apiError('Sign in to send this Improvement', 401)
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message || 'Enter a valid attempt', 400)
    const { id } = await context.params
    await enforceRateLimit({
      scope: 'flag-improvement-attempt',
      identifier: `${session.user.id}:${requestClientId(requestHeaders)}`,
      limit: 40,
      windowSeconds: 60,
    })
    const attempt = await recordFlagImprovementAttempt({
      flagId: id,
      userId: session.user.id,
      ...parsed.data,
    })
    return NextResponse.json({ attempt }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message.includes('owned Product')) {
      return apiError('Flag not found', 404)
    }
    return handleRouteError(error, 'Could not record Improvement attempt')
  }
}
