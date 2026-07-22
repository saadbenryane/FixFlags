import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { recordRateLimit, requestClientId } from '@/lib/security/rate-limit'
import { getOrCreateVisitorToken } from '@/lib/live-support/visitor-token'

const feedbackSchema = z.object({
  vote: z.number().min(-1).max(1),
  comment: z.string().max(500).optional(),
  reason: z
    .enum(['incorrect', 'intentional', 'already_fixed', 'low_priority', 'duplicate'])
    .optional(),
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

    const flag = await prisma.flag.findUnique({
      where: { id: flagId },
      select: {
        id: true,
        auditId: true,
        problem: true,
        checkId: true,
        audit: { select: { userId: true, projectId: true, url: true } },
      },
    })
    if (!flag) return apiError('Flag not found', 404, { code: 'NOT_FOUND' })

    const body = await req.json().catch(() => ({}))
    const parsed = feedbackSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('Choose a valid feedback value', 400, { code: 'INVALID_FEEDBACK' })
    }

    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
    const visitorToken = await getOrCreateVisitorToken()
    const reasonLabel = parsed.data.reason
      ? parsed.data.reason.replace(/_/g, ' ')
      : null
    const commentParts = [
      reasonLabel ? `Dismiss reason: ${reasonLabel}` : null,
      parsed.data.comment?.trim() || null,
    ].filter(Boolean)
    const comment = commentParts.length > 0 ? commentParts.join('. ') : null

    const feedback = await prisma.flagFeedback.upsert({
      where: { flagId_visitorToken: { flagId, visitorToken } },
      create: {
        flagId,
        visitorToken,
        userId: session?.user?.id ?? null,
        vote: parsed.data.vote,
        comment,
      },
      update: {
        vote: parsed.data.vote,
        comment,
        userId: session?.user?.id ?? null,
      },
    })

    const isOwner =
      Boolean(session?.user?.id) && flag.audit.userId === session?.user?.id
    if (parsed.data.dismiss && parsed.data.reason && isOwner) {
      await prisma.flag.update({
        where: { id: flagId },
        data: { status: 'IGNORED' },
      })

      // Intentional / accept-for-now → Product Intelligence memory
      if (
        (parsed.data.reason === 'intentional' || parsed.data.reason === 'low_priority') &&
        flag.audit.userId
      ) {
        const { ensureProductProject, saveProjectIntelligence, loadProjectIntelligence } =
          await import('@/lib/audit/ensure-product-project')
        const {
          appendIntentionalNote,
          appendKnownRisk,
          mergeContractIntoProductIntelligence,
          productIntelligenceFromContract,
        } = await import('@/lib/audit/product-intelligence')
        const { parseProductContract } = await import('@/lib/audit/product-contract')

        let projectId = flag.audit.projectId
        if (!projectId) {
          const project = await ensureProductProject(flag.audit.userId, flag.audit.url)
          projectId = project.id
          await prisma.audit.update({
            where: { id: flag.auditId },
            data: { projectId },
          })
        }

        let pi = await loadProjectIntelligence(projectId)
        if (!pi) {
          const audit = await prisma.audit.findUnique({
            where: { id: flag.auditId },
            select: { productContract: true },
          })
          const contract = parseProductContract(audit?.productContract)
          pi = contract
            ? mergeContractIntoProductIntelligence(null, contract)
            : productIntelligenceFromContract({
                purpose: 'Help visitors get value from this product',
                firstValueJourney: 'Complete the primary journey',
                criticalOutcomes: ['Primary outcomes work'],
                inferredAt: new Date().toISOString(),
                source: 'heuristic',
              })
        }
        const note = parsed.data.comment?.trim()
          ? `${flag.problem} - ${parsed.data.comment.trim()}`
          : flag.problem
        const nextPi =
          parsed.data.reason === 'low_priority'
            ? appendKnownRisk(pi, note)
            : appendIntentionalNote(pi, note)
        await saveProjectIntelligence(projectId, nextPi)
      }
    }

    return NextResponse.json(feedback)
  } catch (error) {
    return handleRouteError(error, 'Could not save feedback')
  }
}
