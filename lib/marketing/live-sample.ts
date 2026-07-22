import { parseLaunchReadiness } from '@/lib/audit/launch-readiness'
import { PIPELINE_VERSION } from '@/lib/audit/pipeline-config'
import type { AuditScreenshot, ScreenshotCaptureStatus } from '@/lib/audit/screenshot-types'
import {
  type RubricComputed,
  type ShareStatus,
} from '@/lib/audit/rubric'
import type { ReportRubricRow } from '@/lib/audit/build-report-shape'
import type { RankableFlag } from '@/lib/audit/priority-flags'

/** Marketing sample provenance. Prefer live curated audits; fixture is offline/demo only. */
export type SampleSource = 'live' | 'curated' | 'fixture'

export type LiveSampleAudit = {
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
  pageSpeedErrors?: { desktopError?: string; mobileError?: string; pageSpeedPartial?: boolean }
  startedAt?: string | Date | null
  rubricRows: ReportRubricRow[]
  flags: RankableFlag[]
  screenshots: AuditScreenshot[]
  launchReadiness: ReturnType<typeof parseLaunchReadiness>
  rubrics: RubricComputed[]
  shareStatus: ShareStatus
}

export type SampleResult = {
  audit: LiveSampleAudit
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

async function fixtureSample(): Promise<SampleResult> {
  const { getStaticSampleAudit } = await import('@/lib/marketing/static-sample')
  const audit = getStaticSampleAudit()
  return {
    audit,
    source: 'fixture',
    pipelineVersion: PIPELINE_VERSION,
    completedAt: audit.completedAt,
  }
}

export async function getLiveSampleAudit(): Promise<SampleResult> {
  // Marketing rendering is deterministic. This versioned snapshot is generated
  // from the completed PlantDad demo audit and reviewed with the sample tests.
  // Production audit rows never affect homepage output or availability.
  const result = await fixtureSample()
  return { ...result, source: 'curated' }
}
