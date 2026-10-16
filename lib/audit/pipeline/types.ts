import type { PageMetadata } from '../metadata'
import type { PageSpeedResult } from '../pagespeed'
import type { FlowScanResult } from '../flow/run-flow-scan'
import type { DeterministicFlag } from '../checks'
import type { TriageResult } from '../judge-triage'
import type { DetectedTech } from '../tech-detect'

import type { TriageFailure } from './triage-failure'
import type {
  ReviewExecutionEventSink,
  ReviewExecutionTrace,
} from '../pipeline-log'
import type { Clock } from '@/lib/time/clock'

export type ReviewStageResultStatus =
  | 'complete'
  | 'partial'
  | 'failed'
  | 'skipped'

export interface ReviewStageResult<TArtifact = unknown> {
  status: ReviewStageResultStatus
  artifact?: TArtifact
  evidenceGaps: string[]
  durationMs: number
  failure?: {
    code: string
    stage: string
    message: string
    retryable: boolean
  }
}

/** Collected page facts survive independently of whole-document metadata. */
export interface PageEvidence {
  navigation?: import('../checks/public-links').PageLinkInventory | null
  preview?: import('../checks/page-preview').PagePreviewObservation
  renderedScope?: import('../browser/observation-scope').CaptureObservationScope
  searchReceipt?: import('../search/contracts').SearchReceipt
  pageId: string
  url: string
  metadata: PageMetadata | null
  desktop: PageSpeedResult | null
  mobile: PageSpeedResult | null
  desktopError?: string
  mobileError?: string
  desktopScreenshot: boolean
  mobileScreenshot: boolean
  flowScan: boolean
  flowResult?: FlowScanResult | null
  desktopBase64: string
  mobileBase64: string | null
  flags: DeterministicFlag[]
  failedModules: string[]
  triage?: TriageResult
  /** Set when triage was attempted but failed (primary page only). */
  triageFailure?: TriageFailure
  /** Detected technologies from HTML + headers analysis. */
  detectedTech: DetectedTech[]
  /** Inferred industry from hostname + page content. */
  industryGuess: string | null
  /** When false, skip triage. Every reviewed page should run triage. */
  runTriage?: boolean
}

/** Whole-page review requires parsed metadata. Summary consumers use PageEvidence. */
export interface PageRun extends PageEvidence {
  metadata: PageMetadata
}

/** Shared state threaded through one audit run. */
export interface ReviewExecutionContext {
  searchResources?: import('../search/collect').SearchResourceCache
  auditId: string
  deadline: number
  startedAt: Date
  clock: Clock
  trace: ReviewExecutionTrace
  events: ReviewExecutionEventSink
  pagespeedCalls: number
  usage: {
    inputTokens: number
    outputTokens: number
    models: string[]
    cacheReadTokens?: number
    cacheWriteTokens?: number
  }
  includeAi: boolean
  /** Reviewed pages were planned but skipped to preserve finalization budget. */
  supplementalPagesSkipped?: boolean
  scanAccess?: import('../scan-access').ScanAccessConfig | null
  openCheckCount?: number
}

/** Current name retained inside the pipeline while call sites migrate by domain. */
export type PipelineContext = ReviewExecutionContext
