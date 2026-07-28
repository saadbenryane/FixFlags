import { parseLaunchReadiness } from '@/lib/audit/launch-readiness'
import { PIPELINE_VERSION } from '@/lib/audit/pipeline-config'
import type { AuditScreenshot, ScreenshotCaptureStatus } from '@/lib/audit/screenshot-types'
import {
  type RubricComputed,
  type ShareStatus,
} from '@/lib/audit/rubric'
import type { ReportRubricRow } from '@/lib/audit/build-report-shape'
import type { RankableFlag } from '@/lib/audit/priority-flags'

/** Marketing sample provenance. The public sample is a repository-owned snapshot. */
export type SampleSource = 'curated'

export type CuratedSampleAudit = {
  id: string
  url: string
  pageJob: string | null
  pageType: string | null
  score: number | null
  verdict: string | null
  completedAt: Date | null
  createdAt: Date
  pipelineVersion: string | null
  reportCompleteness?: 'FULL' | 'PARTIAL' | 'UNKNOWN'
  evidenceCoverage?: unknown
  performanceData?: unknown
  screenshotCapture?: ScreenshotCaptureStatus
  parentId?: string | null
  pageSpeedCoverage?: import('@/lib/audit/pagespeed-coverage').PageSpeedCoverage
  startedAt?: string | Date | null
  rubricRows: ReportRubricRow[]
  flags: RankableFlag[]
  screenshots: AuditScreenshot[]
  launchReadiness: ReturnType<typeof parseLaunchReadiness>
  rubrics: RubricComputed[]
  shareStatus: ShareStatus
  previewMeta?: import('@/lib/audit/preview-meta').PreviewMeta | null
  flowData?: import('@/lib/audit/flow-data').FlowData | null
  actionTimeline?: import('@/lib/audit/action-timeline').ActionTimelineEvent[]
  productContract?: import('@/lib/audit/product-contract').ProductContract | null
  verifiedLearnings?: import('@/lib/audit/product-intelligence').VerifiedLearning[]
  intentionalNotes?: string[]
  knownRisks?: string[]
}

export type SampleResult = {
  audit: CuratedSampleAudit
  source: SampleSource
  pipelineVersion: string
  completedAt: Date | null
}

export type SampleEligibilityInput = {
  reportCompleteness?: string | null
  flags: { id: string }[]
  rubrics: { name: string }[]
  screenshots: { device: string; url: string }[]
}

/** Eligibility for marketing display: completeness, screenshots, and rubric rows. Score is not a gate. */
export function isEligibleMarketingSample(audit: SampleEligibilityInput): boolean {
  if (audit.reportCompleteness !== 'FULL' && audit.reportCompleteness !== 'PARTIAL') {
    return false
  }
  if (audit.flags.length === 0) return false
  if (audit.rubrics.length === 0) return false
  return audit.screenshots.some(
    (s) => s.device === 'DESKTOP' && typeof s.url === 'string' && s.url.length > 0
  )
}

async function loadVersionedSnapshot(): Promise<SampleResult> {
  const { getStaticSampleAudit } = await import('@/lib/marketing/static-sample')
  const audit = getStaticSampleAudit()
  return {
    audit,
    source: 'curated',
    pipelineVersion: PIPELINE_VERSION,
    completedAt: audit.completedAt,
  }
}

export async function getCuratedSampleAudit(): Promise<SampleResult> {
  // Marketing rendering is deterministic. This versioned snapshot is generated
  // from the completed LaunchPad demo audit and reviewed with the sample tests.
  // Production audit rows never affect homepage output or availability.
  return loadVersionedSnapshot()
}
