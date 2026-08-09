import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { resolveCanvasReportAccess } from '@/lib/canvas/access'
import { canvasAccessError, canvasGenerationUnavailable } from '@/lib/canvas/http'
import { canvasRepository } from '@/lib/canvas/repository'
import { buildCanvasEvidenceBundle } from '@/lib/canvas/evidence'
import { CanvasValidationError, validateCanvasDocument } from '@/lib/canvas/validation'
import { generateGroundedCanvas } from '@/lib/canvas/generation'
import { configuredCanvasGenerator, CanvasProviderUnavailableError } from '@/lib/canvas/provider'

const versionActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('restore'), version: z.number().int().positive() }).strict(),
  z.object({ action: z.literal('revise'), instruction: z.string().trim().min(1).max(2_000) }).strict(),
])

async function ownedCanvas(reportId: string, canvasId: string) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  const access = await resolveCanvasReportAccess(reportId, session?.user?.id)
  if (!access.allowed) return { error: canvasAccessError(access) }
  const canvas = await canvasRepository.getCanvas(canvasId)
  if (!canvas || canvas.sourceAuditId !== reportId || canvas.projectId !== access.audit.projectId) {
    return { error: apiError('Canvas not found', 404) }
  }
  return { access, canvas }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; canvasId: string }> }
) {
  try {
    const { id, canvasId } = await params
    const owned = await ownedCanvas(id, canvasId)
    if ('error' in owned) return owned.error ?? apiError('Canvas access denied', 403)
    return NextResponse.json(await canvasRepository.listVersions(canvasId))
  } catch (error) {
    return handleRouteError(error, 'Could not load Canvas versions')
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; canvasId: string }> }
) {
  try {
    const { id, canvasId } = await params
    const owned = await ownedCanvas(id, canvasId)
    if ('error' in owned) return owned.error ?? apiError('Canvas access denied', 403)
    const parsed = versionActionSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return apiError('Choose a valid Canvas revision or version', 400, { code: 'INVALID_CANVAS_REQUEST' })
    if (parsed.data.action === 'revise') {
      const evidence = await buildCanvasEvidenceBundle({ auditId: id, ownerId: owned.access.audit.userId })
      if (!evidence) return apiError('Canvas evidence is no longer available', 409, { code: 'CANVAS_EVIDENCE_UNAVAILABLE' })
      const current = owned.canvas.currentVersion > 0
        ? await canvasRepository.getVersion(canvasId, owned.canvas.currentVersion)
        : null
      try {
        const generated = await generateGroundedCanvas({
          generator: configuredCanvasGenerator,
          instruction: parsed.data.instruction,
          evidence,
          previous: current?.document,
        })
        const version = await canvasRepository.appendVersion({
          canvasId,
          instruction: parsed.data.instruction,
          document: generated.document,
          sourceRefs: generated.sourceRefs,
          model: generated.usage.model,
          inputTokens: generated.usage.inputTokens,
          outputTokens: generated.usage.outputTokens,
          cacheReadTokens: generated.usage.cacheReadTokens,
          cacheWriteTokens: generated.usage.cacheWriteTokens,
          createdById: owned.access.user.id,
        })
        return NextResponse.json(version, { status: 201 })
      } catch (error) {
        if (error instanceof CanvasProviderUnavailableError) return canvasGenerationUnavailable()
        if (error instanceof CanvasValidationError) {
          return apiError('Canvas generation was not grounded in this report', 422, { code: 'INVALID_CANVAS_OUTPUT', action: 'retry' })
        }
        throw error
      }
    }

    const source = await canvasRepository.getVersion(canvasId, parsed.data.version)
    if (!source) return apiError('Canvas version not found', 404)
    const evidence = await buildCanvasEvidenceBundle({ auditId: id, ownerId: owned.access.audit.userId })
    if (!evidence) return apiError('Canvas evidence is no longer available', 409, { code: 'CANVAS_EVIDENCE_UNAVAILABLE' })
    try {
      validateCanvasDocument(source.document, evidence)
    } catch (error) {
      if (error instanceof CanvasValidationError) {
        return apiError('Canvas evidence is no longer valid for this report', 409, { code: 'CANVAS_EVIDENCE_INVALID' })
      }
      throw error
    }
    const sourceIds = new Set(source.sourceRefs.map((reference) => reference.id))
    const restored = await canvasRepository.appendVersion({
      canvasId,
      instruction: `Restore version ${source.version}`,
      document: source.document,
      sourceRefs: evidence.references.filter((reference) => sourceIds.has(reference.id)),
      model: null,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      createdById: owned.access.user.id,
    })
    return NextResponse.json(restored, { status: 201 })
  } catch (error) {
    return handleRouteError(error, 'Could not update Canvas')
  }
}
