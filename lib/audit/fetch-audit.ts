import { cookies, headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { resolveAuditAccess } from '@/lib/audit/access'
import { SHARE_GRANT_COOKIE } from '@/lib/security/share-grant'
import {
  canViewPrescriptionContentForAudit,
  canViewDeterministicFixesForAudit,
  findHighestSeverityFlagWithFix,
  stripAiPrescriptionFromRubrics,
  stripAiPrescriptionFromFlags,
  stripDeterministicFixesFromRubrics,
  stripDeterministicFixesFromFlags,
  stripLegacyDeterministicAudit,
} from '@/lib/audit/report-access'
import { resolveReportTierForAudit } from '@/lib/auth/entitlements'
import {
  deriveScreenshotCaptureStatus,
  parseScreenshotCaptureStatus,
} from '@/lib/audit/screenshot-types'
import { parseLaunchReadiness } from '@/lib/audit/launch-readiness'
import { parsePipelineLog } from '@/lib/audit/pipeline-log'
import { parsePreviewMeta } from '@/lib/audit/preview-meta'
import { parseFlowData, type FlowData } from '@/lib/audit/flow-data'
import { parseEvidenceAnchorsFromPerformanceData } from '@/lib/audit/evidence-highlights'
import { parseFlagVisualEvidence } from '@/lib/audit/persist-visual-evidence'
import { parseActionTimeline } from '@/lib/audit/action-timeline'
import { parseProductContract } from '@/lib/audit/product-contract'
import { parseProductIntelligence } from '@/lib/audit/product-intelligence'
import { rankFlagsByPriority } from '@/lib/audit/priority-flags'

export type { PreviewMeta } from '@/lib/audit/preview-meta'
export type { FlowData }
import { sanitizeRubricForRead } from '@/lib/audit/sanitize-prompts'
import {
  computeShareStatusFromRubrics,
  computeRubricsFromRows,
  type RubricComputed,
  type ShareStatus,
} from '@/lib/audit/rubric'

function parsePageSpeedErrors(performanceData: unknown): {
  desktopError?: string
  mobileError?: string
  pageSpeedPartial?: boolean
} {
  if (!performanceData || typeof performanceData !== 'object') return {}
  const data = performanceData as Record<string, unknown>
  const desktopError =
    typeof data.desktopError === 'string' ? data.desktopError : undefined
  const mobileError =
    typeof data.mobileError === 'string' ? data.mobileError : undefined
  const pageSpeedPartial =
    Boolean(desktopError || mobileError) ||
    data.desktop === null ||
    data.mobile === null
  return { desktopError, mobileError, pageSpeedPartial }
}

export const auditFullInclude = {
  rubrics: {
    include: {
      flags: {
        orderBy: { position: 'asc' as const },
      },
    },
    orderBy: { name: 'asc' as const },
  },
  flags: {
    orderBy: { position: 'asc' as const },
  },
  pages: {
    orderBy: { position: 'asc' as const },
    include: {
      flags: {
        select: { severity: true },
      },
    },
  },
  journeyReviews: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      steps: {
        orderBy: { stepNumber: 'asc' as const },
        select: {
          stepNumber: true,
          actionType: true,
          url: true,
          screenshotAfterUrl: true,
          reasoning: true,
        },
      },
      _count: { select: { findings: true } },
    },
  },
  screenshots: true,
  project: {
    select: {
      id: true,
      productIntelligence: true,
      watchInterval: true,
    },
  },
} as const

async function fetchAuditRow(id: string) {
  return prisma.audit.findUnique({
    where: { id },
    include: auditFullInclude,
  })
}

/** Remove large JSON blobs not used by the report UI. */
export function stripInternalAuditFields<T extends Record<string, unknown>>(audit: T) {
  const { htmlMetadata, performanceData, consoleErrors, ...rest } = audit
  void htmlMetadata
  void performanceData
  void consoleErrors
  return rest
}

export async function resolveSessionUser() {
  return auth.api.getSession({ headers: await headers() }).catch(() => null)
}

export async function resolveIsPaidForAudit(
  audit: { userId: string | null; isPublic: boolean }
): Promise<boolean> {
  const tier = await resolveReportTierForAudit(audit)
  return tier === 'paid'
}

export async function getGatedAuditForRequest(id: string) {
  const session = await resolveSessionUser()
  const audit = await fetchAuditRow(id)

  if (!audit) {
    return { kind: 'not_found' as const }
  }

  const shareGrant = (await cookies()).get(SHARE_GRANT_COOKIE)?.value
  const accessContext = await resolveAuditAccess(audit, session?.user, shareGrant)
  if (accessContext === 'denied') {
    return { kind: 'forbidden' as const }
  }

  const isPaid = await resolveIsPaidForAudit(audit)
  const sharedFullAccess = accessContext === 'share_grant' || accessContext === 'agency_public'
  const showPrescription = sharedFullAccess
    ? Boolean(audit.aiReviewAt)
    : await canViewPrescriptionContentForAudit(
    {
      userId: audit.userId,
      aiReviewAt: audit.aiReviewAt,
      isPublic: audit.isPublic,
    },
    session?.user
      )
  const showDeterministicFixes = sharedFullAccess
    ? true
    : await canViewDeterministicFixesForAudit(
    {
      userId: audit.userId,
      aiReviewAt: audit.aiReviewAt,
      isPublic: audit.isPublic,
    },
    session?.user
      )
  const hasTriage = Boolean(audit.triageAt)
  const isLegacyDeterministic = !hasTriage && !audit.aiReviewAt && !audit.failureCode
  const triageDegraded =
    audit.status === 'COMPLETED' && !hasTriage && Boolean(audit.failureCode)
  const prescriptionFailed =
    hasTriage &&
    Boolean(audit.includeAi) &&
    !audit.aiReviewAt &&
    (audit.failureCode === 'AI_REVIEW_FAILED' || audit.failureCode === 'AI_CONTRACT_INVALID')
  // includeAi is set at claim enqueue time (before the job starts) so pending UI works
  // immediately after signup refresh; JUDGING covers in-flight prescription.
  const aiReviewPending =
    hasTriage &&
    !audit.aiReviewAt &&
    audit.status !== 'FAILED' &&
    !prescriptionFailed &&
    (Boolean(audit.includeAi) || audit.status === 'JUDGING')

  let sanitizedRubrics = audit.rubrics.map((rubric) => sanitizeRubricForRead(rubric))
  let reportFlags = audit.flags

  if (isLegacyDeterministic) {
    const legacy = stripLegacyDeterministicAudit({
      ...audit,
      rubrics: sanitizedRubrics,
      flags: reportFlags,
    })
    sanitizedRubrics = legacy.rubrics as typeof sanitizedRubrics
    reportFlags = legacy.flags as typeof reportFlags
  } else if (!showDeterministicFixes) {
    sanitizedRubrics = stripDeterministicFixesFromRubrics(sanitizedRubrics) as typeof sanitizedRubrics
    reportFlags = stripDeterministicFixesFromFlags(reportFlags) as typeof reportFlags
  } else if (!showPrescription) {
    sanitizedRubrics = stripAiPrescriptionFromRubrics(sanitizedRubrics) as typeof sanitizedRubrics
    reportFlags = stripAiPrescriptionFromFlags(reportFlags) as typeof reportFlags
  }

  const stripped = stripInternalAuditFields({ ...audit, rubrics: sanitizedRubrics, flags: reportFlags })
  const launchReadiness =
    hasTriage || showPrescription ? parseLaunchReadiness(audit.launchReadiness) : null
  const pageSpeed = parsePageSpeedErrors(audit.performanceData)
  const ogImageBroken = audit.flags.some(
    (f) => f.checkId === 'og-image-broken' && f.status !== 'FIXED'
  )
  const previewMeta = parsePreviewMeta(audit.htmlMetadata, audit.url, {
    ogImageOk: !ogImageBroken,
  })
  const flowData = parseFlowData(audit.flowData)
  const evidenceAnchors = parseEvidenceAnchorsFromPerformanceData(audit.performanceData)
  const flagVisualEvidence = parseFlagVisualEvidence(audit.performanceData)
  const actionTimeline = parseActionTimeline(audit.performanceData)
  const productContract = parseProductContract(audit.productContract)
  const productIntelligence = parseProductIntelligence(audit.project?.productIntelligence)
  const verifiedLearnings = productIntelligence?.verifiedLearnings?.slice(0, 8) ?? []
  const intentionalNotes = productIntelligence?.intentionalNotes?.slice(0, 5) ?? []
  const knownRisks = productIntelligence?.knownRisks?.slice(0, 5) ?? []
  const watchInterval = audit.project?.watchInterval === 'WEEKLY'
    ? 'weekly'
    : audit.project?.watchInterval === 'DAILY'
      ? 'daily'
      : null

  const rubricSources = sanitizedRubrics.map((r) => ({
    name: r.name,
    grade: r.grade,
    score: r.score,
    flags: r.flags.map((f: { severity: string; id?: string }) => ({ severity: f.severity, id: f.id })),
  }))
  const flatFlags = reportFlags.map((f) => ({
    severity: f.severity,
    rubric: f.rubric,
  }))
  const rubrics: RubricComputed[] = computeRubricsFromRows(rubricSources, flatFlags)
  const shareStatus: ShareStatus = computeShareStatusFromRubrics(rubricSources, flatFlags)

  const rubricRows = sanitizedRubrics.map((r) => ({
    id: r.id,
    name: r.name,
    grade: r.grade,
    score: r.score,
    status: r.status,
    summary: r.summary,
    rubricPrompt: r.rubricPrompt,
    flags: r.flags.map((f) => ({
      id: f.id,
      checkId: f.checkId,
      rubric: f.rubric,
      severity: f.severity,
      impactTag: f.impactTag,
      problem: f.problem,
      evidence: f.evidence,
      whyItMatters: f.whyItMatters,
      fix: f.fix,
      agentPrompt: f.agentPrompt,
      cursorPrompt: f.cursorPrompt,
      claudePrompt: f.claudePrompt,
      windsurfPrompt: f.windsurfPrompt,
      lovablePrompt: f.lovablePrompt,
      boltPrompt: f.boltPrompt,
      verificationRule: f.verificationRule,
      pageUrl: f.pageUrl,
      confidence: f.confidence,
      source: f.source ?? undefined,
    })),
  }))

  const storedCapture = parseScreenshotCaptureStatus(audit.performanceData)
  const screenshotCapture = deriveScreenshotCaptureStatus(
    audit.status,
    audit.screenshots,
    storedCapture
  )

  const sampleFixFlag =
    !showDeterministicFixes && !isLegacyDeterministic
      ? findHighestSeverityFlagWithFix(
          rankFlagsByPriority(audit.flags, audit.rubrics, 3, productContract).map(
            ({ flag }) => flag
          )
        )
      : null

  return {
    kind: 'ok' as const,
    accessContext,
    audit: {
      ...stripped,
      verdict: hasTriage || showPrescription ? stripped.verdict : null,
      pageJob: hasTriage || showPrescription ? stripped.pageJob : null,
      pageType: hasTriage || showPrescription ? stripped.pageType : null,
      pipelineLog: parsePipelineLog(audit.pipelineLog),
      screenshotCapture,
      launchReadiness,
      rubrics,
      shareStatus,
      pageSpeedErrors: pageSpeed,
      previewMeta,
      flowData,
      evidenceAnchors,
      flagVisualEvidence,
      actionTimeline,
      productContract,
      verifiedLearnings,
      intentionalNotes,
      knownRisks,
      watchInterval,
      triageAt: audit.triageAt,
      isLegacyDeterministic,
      rubricRows,
    },
    isPaid,
    isLoggedIn: !!session?.user,
    showPrescription,
    showDeterministicFixes,
    aiReviewPending,
    triageDegraded,
    prescriptionFailed,
    sampleFixFlag,
    session,
  }
}
