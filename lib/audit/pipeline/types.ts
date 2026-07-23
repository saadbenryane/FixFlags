import type { PageMetadata } from '../metadata'
import type { PageSpeedResult } from '../pagespeed'
import type { FlowScanResult } from '../flow/run-flow-scan'
import type { DeterministicFlag } from '../checks'
import type { TriageResult } from '../judge-triage'
import type { DetectedTech } from '../tech-detect'

import type { TriageFailure } from './triage-failure'

/** Result of running the pipeline against a single page (primary or critical-path). */
export interface PageRun {
  pageId: string
  url: string
  metadata: PageMetadata
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
  /** When false, skip triage (secondary critical-path pages). */
  runTriage?: boolean
}

/** Shared state threaded through one audit run. */
export interface PipelineContext {
  auditId: string
  deadline: number
  startedAt: Date
  pagespeedCalls: number
  usage: {
    inputTokens: number
    outputTokens: number
    models: string[]
    cacheReadTokens?: number
    cacheWriteTokens?: number
  }
  includeAi: boolean
  scanAccess?: import('../scan-access').ScanAccessConfig | null
}
