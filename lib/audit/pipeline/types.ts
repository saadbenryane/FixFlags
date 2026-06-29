import type { PageMetadata } from '../metadata'
import type { PageSpeedResult } from '../pagespeed'
import type { FlowScanResult } from '../flow/run-flow-scan'
import type { DeterministicFlag } from '../checks'
import type { JudgeResult } from '../judge'

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
  judge?: JudgeResult
}

/** Shared state threaded through one audit run. */
export interface PipelineContext {
  auditId: string
  deadline: number
  startedAt: Date
  pagespeedCalls: number
  usage: { inputTokens: number; outputTokens: number; models: string[] }
  includeAi: boolean
}
