import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { resolveCanvasReportAccess } from '@/lib/canvas/access'
import { canvasAccessError, canvasGenerationUnavailable } from '@/lib/canvas/http'
import { canvasRepository } from '@/lib/canvas/repository'
import { buildCanvasEvidenceBundle } from '@/lib/canvas/evidence'
import { generateGroundedCanvas } from '@/lib/canvas/generation'
import { configuredCanvasGenerator, CanvasProviderUnavailableError } from '@/lib/canvas/provider'
import { CanvasValidationError } from '@/lib/canvas/validation'

const createSchema = z.object({
  title: z.string().trim().min(1).max(240),
  instruction: z.string().trim().min(1).max(2_000),
}).strict()

async function access(reportId: string) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  return resolveCanvasReportAccess(reportId, session?.user?.id)
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const resolved = await access(id)
    if (!resolved.allowed) return canvasAccessError(resolved)
    return NextResponse.json(await canvasRepository.listCanvases({
      projectId: resolved.audit.projectId,
      sourceAuditId: resolved.audit.id,
    }))
  } catch (error) {
    return handleRouteError(error, 'Could not load Canvases')
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const resolved = await access(id)
    if (!resolved.allowed) return canvasAccessError(resolved)
    const parsed = createSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return apiError('Canvas title and instruction are required', 400, { code: 'INVALID_CANVAS_REQUEST' })
    const evidence = await buildCanvasEvidenceBundle({
      auditId: resolved.audit.id,
      ownerId: resolved.audit.userId,
    })
    if (!evidence) return apiError('Canvas evidence is not available for this report', 409, { code: 'CANVAS_EVIDENCE_UNAVAILABLE' })
    try {
      const generated = await generateGroundedCanvas({
        generator: configuredCanvasGenerator,
        instruction: parsed.data.instruction,
        evidence,
      })
      const canvas = await canvasRepository.createCanvas({
        projectId: evidence.projectId,
        sourceAuditId: evidence.auditId,
        title: generated.document.title,
        createdById: resolved.user.id,
      })
      try {
        const version = await canvasRepository.appendVersion({
          canvasId: canvas.id,
          instruction: parsed.data.instruction,
          document: generated.document,
          sourceRefs: generated.sourceRefs,
          model: generated.usage.model,
          inputTokens: generated.usage.inputTokens,
          outputTokens: generated.usage.outputTokens,
          cacheReadTokens: generated.usage.cacheReadTokens,
          cacheWriteTokens: generated.usage.cacheWriteTokens,
          createdById: resolved.user.id,
        })
        return NextResponse.json({ canvas: await canvasRepository.getCanvas(canvas.id), current: version }, { status: 201 })
      } catch (error) {
        await canvasRepository.markFailed(canvas.id)
        throw error
      }
    } catch (error) {
      if (error instanceof CanvasProviderUnavailableError) return canvasGenerationUnavailable()
      if (error instanceof CanvasValidationError) {
        return apiError('Canvas generation was not grounded in this report', 422, { code: 'INVALID_CANVAS_OUTPUT', action: 'retry' })
      }
      throw error
    }
  } catch (error) {
    return handleRouteError(error, 'Could not create Canvas')
  }
}
