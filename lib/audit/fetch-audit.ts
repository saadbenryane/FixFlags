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
import { loadTechnologyProfile } from '@/lib/audit/technology-profile'
import { progressiveAuditSelect } from '@/lib/audit/progressive-audit-select'

export type { PreviewMeta } from '@/lib/audit/preview-meta'
export type { FlowData }
import { sanitizeRubricForRead } from '@/lib/audit/sanitize-prompts'
import {
  computeShareStatusFromRubrics,
  computeRubricsFromRows,
  type RubricComputed,
  type ShareStatus,
} from '@/lib/audit/rubric'
import { derivePageSpeedCoverage } from '@/lib/audit/pagespeed-coverage'

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
  const {
    htmlMetadata,
    performanceData,
    consoleErrors,
    scanAccessEncrypted,
    gclid,
    fbclid,
    leadSyncedAt,
    referrer,
    utmSource,
    utmMedium,
    utmCampaign,
    failureMetadata,
    ...rest
  } = audit
  void htmlMetadata
  void performanceData
  void consoleErrors
  void scanAccessEncrypted
  void gclid
  void fbclid
  void leadSyncedAt
  void referrer
  void utmSource
  void utmMedium
  void utmCampaign
  void failureMetadata
  return rest
}

export async function resolveSessionUser() {
  return auth.api.getSession({ headers: await headers() }).catch(() => null)
}

const MAX_ATTACHED_CHILD_HOPS = 20

/** Follow the newest attached Recheck so a bookmarked parent URL still opens this work. */
export async function resolveLatestAttachedWorkId(id: string): Promise<string> {
  let current = id
  for (let hop = 0; hop < MAX_ATTACHED_CHILD_HOPS; hop += 1) {
    const child = await prisma.audit.findFirst({
      where: { parentId: current },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true },
    })
    if (!child) return current
    current = child.id
  }
  return current
}

export async function resolveIsPaidForAudit(
  audit: { userId: string | null; isPublic: boolean }
): Promise<boolean> {
  const tier = await resolveReportTierForAudit(audit)
  return tier === 'paid'
}

export function redactCompletedPrivateReportData<T extends {
  project: unknown
  pages: unknown[]
  journeyReviews: unknown[]
  pipelineLog: unknown[]
  watchInterval: unknown
  triageAt: unknown
  flowData: unknown
  actionTimeline: unknown[]
  productContract: unknown
}>(input: T, canAccessPrivateReportData: boolean): T {
  if (canAccessPrivateReportData) return input
  return {
    ...input,
    project: null,
    pages: [],
    journeyReviews: [],
    pipelineLog: [],
    watchInterval: null,
    triageAt: null,
    flowData: null,
    actionTimeline: [],
    productContract: null,
  }
}

/**
 * Resolve access and the minimum state needed to render an unfinished report.
 * Completed reports deliberately return only an access envelope; callers then
 * opt into the heavier completed-report graph.
 */
export async function getProgressiveAuditForRequest(id: string) {
  const [session, requested] = await Promise.all([
    resolveSessionUser(),
    prisma.audit.findUnique({
      where: { id },
      select: progressiveAuditSelect,
    }),
  ])

  if (!requested) return { kind: 'not_found' as const }

  const shareGrant = (await cookies()).get(SHARE_GRANT_COOKIE)?.value
  const accessContext = await resolveAuditAccess(requested, session?.user, shareGrant)
  if (accessContext === 'denied') return { kind: 'forbidden' as const }

  const workId = await resolveLatestAttachedWorkId(id)
  const audit = workId === id
    ? requested
    : await prisma.audit.findUnique({
        where: { id: workId },
        select: progressiveAuditSelect,
      })
  if (!audit) return { kind: 'not_found' as const }

  if (audit.status === 'COMPLETED') {
    return {
      kind: 'completed' as const,
      audit: {
        url: audit.url,
        score: audit.score,
        verdict: audit.verdict,
        userId: audit.userId,
        isPublic: audit.isPublic,
        flags: audit.flags.map(({ severity, problem }) => ({
          severity,
          problem,
        })),
      },
    }
  }

  const storedCapture = parseScreenshotCaptureStatus(audit.performanceData)
  const screenshotCapture = deriveScreenshotCaptureStatus(
    audit.status,
    audit.screenshots,
    storedCapture
  )
  const { performanceData, productContract, ...publicAudit } = audit

  return {
    kind: 'progressive' as const,
    accessContext,
    session,
    audit: {
      ...publicAudit,
      screenshotCapture,
      actionTimeline: accessContext === 'owner' ? parseActionTimeline(performanceData) : [],
      productContract: accessContext === 'owner' ? parseProductContract(productContract) : null,
    },
  }
}

export async function getGatedAuditForRequest(id: string) {
  const session = await resolveSessionUser()
  const requested = await fetchAuditRow(id)

  if (!requested) {
    return { kind: 'not_found' as const }
  }

  const shareGrant = (await cookies()).get(SHARE_GRANT_COOKIE)?.value
  const accessContext = await resolveAuditAccess(requested, session?.user, shareGrant)
  if (accessContext === 'denied') {
    return { kind: 'forbidden' as const }
  }

  const workId = await resolveLatestAttachedWorkId(id)
  const audit = workId === id ? requested : await fetchAuditRow(workId)
  if (!audit) {
    return { kind: 'not_found' as const }
  }
  const isPaid = await resolveIsPaidForAudit(audit)
  const mayViewPrompts = accessContext === 'owner' || accessContext === 'marketing_sample'
  const showPrescription = mayViewPrompts && await canViewPrescriptionContentForAudit(
    {
      userId: audit.userId,
      aiReviewAt: audit.aiReviewAt,
      isPublic: audit.isPublic,
    },
    session?.user
      )
  const showDeterministicFixes = mayViewPrompts && await canViewDeterministicFixesForAudit(
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
  const canAccessPrivateReportData = accessContext === 'owner'
  const launchReadiness =
    hasTriage || showPrescription ? parseLaunchReadiness(audit.launchReadiness) : null
  const pageSpeedCoverage = derivePageSpeedCoverage(
    audit.pages.length > 0
      ? audit.pages.map((page) => ({
          url: page.url,
          performanceData: page.performanceData,
        }))
      : [{ url: audit.url, performanceData: audit.performanceData }]
  )
  const ogImageBroken = audit.flags.some(
    (f) => f.checkId === 'og-image-broken' && f.status !== 'FIXED'
  )
  const previewMeta = parsePreviewMeta(audit.htmlMetadata, audit.url, {
    ogImageOk: !ogImageBroken,
  })
  const flowData = canAccessPrivateReportData ? parseFlowData(audit.flowData) : null
  const evidenceAnchors = parseEvidenceAnchorsFromPerformanceData(audit.performanceData)
  const flagVisualEvidence = parseFlagVisualEvidence(audit.performanceData)
  const actionTimeline = canAccessPrivateReportData ? parseActionTimeline(audit.performanceData) : []
  const productContract = canAccessPrivateReportData ? parseProductContract(audit.productContract) : null
  const productIntelligence = canAccessPrivateReportData
    ? parseProductIntelligence(audit.project?.productIntelligence)
    : null
  const verifiedLearnings = productIntelligence?.verifiedLearnings?.slice(0, 8) ?? []
  const intentionalNotes = productIntelligence?.intentionalNotes?.slice(0, 5) ?? []
  const knownRisks = productIntelligence?.knownRisks?.slice(0, 5) ?? []
  const watchInterval = canAccessPrivateReportData
    ? audit.project?.watchInterval === 'WEEKLY'
      ? 'weekly'
      : audit.project?.watchInterval === 'DAILY'
        ? 'daily'
        : null
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

  const rankedOpenFlags = rankFlagsByPriority(
    audit.flags.filter((flag) => flag.status !== 'FIXED' && flag.status !== 'IGNORED'),
    audit.rubrics,
    audit.flags.length,
    productContract
  ).map(({ flag }) => flag)
  const sampleFixFlag =
    !showDeterministicFixes && !isLegacyDeterministic
      ? findHighestSeverityFlagWithFix(
          accessContext === 'marketing_sample'
            ? rankedOpenFlags
            : rankedOpenFlags.filter((flag) => flag.rubric === 'MESSAGE')
        )
      : null

  const technologyProfile = await loadTechnologyProfile(audit.id, {
    score: audit.score,
    rubrics: sanitizedRubrics.map((rubric) => ({
      name: rubric.name,
      score: rubric.score,
    })),
    flags: reportFlags.map((flag) => ({
      rubric: flag.rubric,
      status: flag.status,
    })),
  })

  const privateProjection = redactCompletedPrivateReportData({
    project: stripped.project,
    pages: stripped.pages,
    journeyReviews: stripped.journeyReviews,
    pipelineLog: parsePipelineLog(audit.pipelineLog),
    watchInterval,
    triageAt: audit.triageAt,
    flowData,
    actionTimeline,
    productContract,
  }, canAccessPrivateReportData)

  return {
    kind: 'ok' as const,
    accessContext,
    audit: {
      ...stripped,
      project: privateProjection.project,
      pages: privateProjection.pages,
      journeyReviews: privateProjection.journeyReviews,
      verdict: hasTriage || showPrescription ? stripped.verdict : null,
      pageJob: hasTriage || showPrescription ? stripped.pageJob : null,
      pageType: hasTriage || showPrescription ? stripped.pageType : null,
      pipelineLog: privateProjection.pipelineLog,
      screenshotCapture,
      launchReadiness,
      rubrics,
      shareStatus,
      pageSpeedCoverage,
      previewMeta,
      flowData: privateProjection.flowData,
      evidenceAnchors,
      flagVisualEvidence,
      actionTimeline: privateProjection.actionTimeline,
      productContract: privateProjection.productContract,
      verifiedLearnings,
      intentionalNotes,
      knownRisks,
      watchInterval: privateProjection.watchInterval,
      triageAt: privateProjection.triageAt,
      isLegacyDeterministic,
      rubricRows,
      technologyProfile,
    },
    isPaid,
    isLoggedIn: !!session?.user,
    showPrescription,
    showDeterministicFixes,
    aiReviewPending,
    triageDegraded,
    prescriptionFailed,
    sampleFixFlag,
    session: session?.user ? { user: { id: session.user.id } } : null,
  }
}
