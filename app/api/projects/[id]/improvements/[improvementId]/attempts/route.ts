import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { enforceRateLimit, requestClientId } from '@/lib/security/rate-limit'
import { createImprovementAttempt } from '@/lib/improvements/service'

const attemptSchema = z.object({
  builder: z.string().trim().min(1).max(80),
  sourceAuditId: z.string().trim().min(1),
  handoffReference: z.string().trim().max(500).optional(),
  pullRequestReference: z.string().trim().max(500).optional(),
  deploymentReference: z.string().trim().max(500).optional(),
  changeSummary: z.string().trim().min(1).max(2_000),
})

interface RouteContext {
  params: Promise<{ id: string; improvementId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const requestHeaders = await headers()
    const session = await auth.api.getSession({ headers: requestHeaders })
    if (!session?.user?.id) return apiError('Sign in to send an Improvement', 401)

    const { id, improvementId } = await context.params
    await enforceRateLimit({
      scope: 'improvement-attempt',
      identifier: `${session.user.id}:${requestClientId(requestHeaders)}`,
      limit: 30,
      windowSeconds: 60,
    })
    const parsed = attemptSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return apiError('Enter a valid builder handoff', 400)

    const attempt = await createImprovementAttempt({
      improvementId,
      projectId: id,
      userId: session.user.id,
      ...parsed.data,
    })
    return NextResponse.json({ attempt }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'Improvement not found for Product') {
      return apiError('Improvement not found', 404)
    }
    return handleRouteError(error, 'Could not record Improvement attempt')
  }
}
