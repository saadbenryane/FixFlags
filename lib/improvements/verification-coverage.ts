import type { ReportCompleteness } from '@prisma/client'

type EvidenceCoverage = {
  desktopScreenshot?: boolean
  mobileScreenshot?: boolean
  metadata?: boolean
  aiAssessment?: boolean
  flowScan?: boolean
}

export type VerificationCoverage = {
  completeReview: boolean
  evidenceComparable: boolean
  relevantPageCovered: boolean
  verifierExecuted: boolean
  failedModules: string[]
  source: string
  pageUrl: string | null
}

export type VerificationCoverageDecision = {
  comparable: boolean
  reason: string
  coverage: VerificationCoverage
}

function parseFailedModules(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function parseEvidenceCoverage(value: unknown): EvidenceCoverage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as EvidenceCoverage
}

function normalizeUrl(value: string): string {
  try {
    const url = new URL(value)
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return value.replace(/\/$/, '')
  }
}

export function assessVerificationCoverage(input: {
  status: string
  reportCompleteness: ReportCompleteness
  evidenceCoverage: unknown
  failedModules: unknown
  journeyReviewIncluded: boolean
  journeyReviewAt: Date | null
  pages: Array<{ url: string; status: string }>
  source: string
  checkId: string | null
  pageUrl: string | null
}): VerificationCoverageDecision {
  const failedModules = parseFailedModules(input.failedModules)
  const evidence = parseEvidenceCoverage(input.evidenceCoverage)
  const isAi = input.source === 'AI'
  const isJourney = input.checkId?.startsWith('journey-') ?? false
  const completeReview =
    input.status === 'COMPLETED' && input.reportCompleteness === 'FULL'
  const evidenceComparable = Boolean(
    evidence.desktopScreenshot && evidence.metadata && (!isAi || evidence.aiAssessment)
  )
  const relevantPageCovered = input.pageUrl
    ? input.pages.some(
        (page) =>
          page.status === 'COMPLETED' && normalizeUrl(page.url) === normalizeUrl(input.pageUrl!)
      )
    : input.pages.some((page) => page.status === 'COMPLETED')
  const verifierExecuted = isJourney
    ? input.journeyReviewIncluded && Boolean(input.journeyReviewAt)
    : isAi
      ? Boolean(evidence.aiAssessment)
      : failedModules.length === 0

  const coverage: VerificationCoverage = {
    completeReview,
    evidenceComparable,
    relevantPageCovered,
    verifierExecuted,
    failedModules,
    source: input.source,
    pageUrl: input.pageUrl,
  }

  if (!completeReview) {
    return { comparable: false, reason: 'The update Review was partial or incomplete.', coverage }
  }
  if (!evidenceComparable) {
    return { comparable: false, reason: 'The update Review did not capture comparable evidence.', coverage }
  }
  if (!relevantPageCovered) {
    return { comparable: false, reason: 'The update Review did not complete the affected page.', coverage }
  }
  if (!verifierExecuted) {
    return {
      comparable: false,
      reason: isJourney
        ? 'The applicable journey verification did not complete.'
        : failedModules.length > 0
          ? `Deterministic verification was incomplete: ${failedModules.join(', ')}.`
          : 'The applicable verifier did not complete.',
      coverage,
    }
  }
  return {
    comparable: true,
    reason: 'The fresh update Review completed comparable verification coverage.',
    coverage,
  }
}
