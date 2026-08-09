import { prisma } from '@/lib/db'
import { buildUnifiedFixList } from '@/lib/audit/load-finish-plan-flags'
import { computeRubricsFromRows } from '@/lib/audit/rubric'
import { parseProductIntelligence, productNameFromUrl } from '@/lib/audit/product-intelligence'
import type { CanvasEvidenceBundle, CanvasSourceReference } from '@/lib/canvas/domain'
import type { RubricName, SeverityName } from '@/lib/audit/constants'

/**
 * Build the only evidence shape a Canvas generator may receive. The caller must
 * authorize owner + paid access first. Prompts, raw rows, URLs, and storage
 * locations are deliberately absent.
 */
export async function buildCanvasEvidenceBundle(input: {
  auditId: string
  ownerId: string
}): Promise<CanvasEvidenceBundle | null> {
  const audit = await prisma.audit.findFirst({
    where: { id: input.auditId, userId: input.ownerId },
    select: {
      id: true,
      userId: true,
      projectId: true,
      url: true,
      score: true,
      project: { select: { productIntelligence: true } },
      flags: {
        orderBy: { position: 'asc' },
        select: {
          id: true, checkId: true, rubric: true, severity: true, impactTag: true,
          problem: true, evidence: true, whyItMatters: true, fix: true,
          agentPrompt: true, cursorPrompt: true, claudePrompt: true, windsurfPrompt: true,
          lovablePrompt: true, boltPrompt: true, verificationRule: true, pageUrl: true,
          confidence: true, source: true, status: true, position: true,
        },
      },
      rubrics: { select: { id: true, name: true, score: true, grade: true, status: true, assessmentState: true, summary: true, rubricPrompt: true } },
      screenshots: { orderBy: { id: 'asc' }, select: { id: true, device: true } },
    },
  })
  if (!audit?.projectId) return null

  const computedRubrics = computeRubricsFromRows(
    audit.rubrics.map((row) => ({
      name: row.name,
      score: row.score,
      grade: row.grade,
      status: row.status,
      assessmentState: row.assessmentState,
      flags: [],
    })),
    audit.flags
  )
  const fixList = await buildUnifiedFixList({
    userId: audit.userId,
    auditUrl: audit.url,
    flags: audit.flags,
    rubricRows: audit.rubrics.map((row) => ({ name: row.name, grade: row.grade })),
    contract: null,
    promptAccess: 'none',
  })

  const references: CanvasSourceReference[] = [{
    id: `audit:${audit.id}`, kind: 'audit', auditId: audit.id, entityId: audit.id,
  }]
  const rubrics = computedRubrics.map((row) => {
    const source = audit.rubrics.find((rubric) => rubric.name === row.name)
    const refId = `rubric:${row.name.toLowerCase()}`
    references.push({ id: refId, kind: 'rubric', auditId: audit.id, entityId: source?.id ?? row.name })
    return { refId, rubric: row.name, score: row.score ?? null, status: row.status }
  })
  const flags = fixList.items.map((flag, index) => {
    const refId = `flag:${flag.id}`
    references.push({ id: refId, kind: 'flag', auditId: audit.id, entityId: flag.id })
    return {
      refId,
      id: flag.id,
      rank: index + 1,
      rubric: flag.rubric as RubricName,
      severity: flag.severity as SeverityName,
      problem: flag.problem,
      evidence: flag.evidence,
      whyItMatters: flag.whyItMatters ?? null,
    }
  })
  const captures = audit.screenshots.map((capture) => {
    const refId = `capture:${capture.id}`
    references.push({ id: refId, kind: 'capture', auditId: audit.id, entityId: capture.id })
    return {
      refId,
      id: capture.id,
      assetId: capture.id,
      label: `${capture.device === 'MOBILE' ? 'Mobile' : 'Desktop'} observation`,
      viewport: capture.device === 'MOBILE' ? 'mobile' as const : 'desktop' as const,
      phase: 'observation' as const,
    }
  })
  const intelligence = parseProductIntelligence(audit.project?.productIntelligence)
  const memory = (intelligence?.verifiedLearnings ?? []).map((learning, index) => {
    const id = `${learning.auditId}:${learning.checkId ?? index}`
    const refId = `memory:${id}`
    references.push({ id: refId, kind: 'memory', auditId: audit.id, entityId: id })
    return { refId, id, label: 'Verified learning', value: learning.summary }
  })

  return {
    auditId: audit.id,
    projectId: audit.projectId,
    references,
    audit: { score: audit.score, title: productNameFromUrl(audit.url) },
    rubrics,
    flags,
    captures,
    memory,
  }
}
