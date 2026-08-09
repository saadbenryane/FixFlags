import type { RubricName, SeverityName } from '@/lib/audit/constants'

export const CANVAS_SCHEMA_VERSION = 1 as const

export type CanvasStatus = 'GENERATING' | 'READY' | 'FAILED'

export type CanvasSourceKind = 'audit' | 'rubric' | 'flag' | 'capture' | 'memory'

/**
 * Opaque reference to evidence already authorized and assembled by the server.
 * Canvas documents never carry database rows, URLs, prompts, or storage locations.
 */
export interface CanvasSourceReference {
  id: string
  kind: CanvasSourceKind
  auditId: string
  entityId: string
}

interface CanvasBlockBase {
  id: string
  sourceRefIds: string[]
}

export interface ScoreSummaryBlock extends CanvasBlockBase {
  type: 'score-summary'
  score: number
  label: string
}

export interface RubricComparisonBlock extends CanvasBlockBase {
  type: 'rubric-comparison'
  rubrics: Array<{
    rubric: RubricName
    score: number | null
    status: 'PASS' | 'NEEDS_ATTENTION' | 'BLOCKED'
  }>
}

export interface RankedFlagsBlock extends CanvasBlockBase {
  type: 'ranked-flags'
  title: string
  flagIds: string[]
}

export interface EvidenceGalleryBlock extends CanvasBlockBase {
  type: 'evidence-gallery'
  title: string
  items: Array<{
    captureRefId: string
    caption: string
  }>
}

export interface BeforeAfterBlock extends CanvasBlockBase {
  type: 'before-after'
  title: string
  beforeCaptureRefId: string
  afterCaptureRefId: string
  summary: string
}

export interface ProductMemoryBlock extends CanvasBlockBase {
  type: 'product-memory'
  title: string
  memoryRefIds: string[]
}

export interface FinishPlanBlock extends CanvasBlockBase {
  type: 'finish-plan'
  title: string
  flagIds: string[]
}

export interface HeadingBlock extends CanvasBlockBase {
  type: 'heading'
  level: 2 | 3
  text: string
}

export interface TextBlock extends CanvasBlockBase {
  type: 'text'
  text: string
}

export interface CalloutBlock extends CanvasBlockBase {
  type: 'callout'
  tone: 'info' | 'success' | 'warning'
  title: string
  text: string
}

export type CanvasBlock =
  | ScoreSummaryBlock
  | RubricComparisonBlock
  | RankedFlagsBlock
  | EvidenceGalleryBlock
  | BeforeAfterBlock
  | ProductMemoryBlock
  | FinishPlanBlock
  | HeadingBlock
  | TextBlock
  | CalloutBlock

export interface CanvasDocument {
  schemaVersion: typeof CANVAS_SCHEMA_VERSION
  title: string
  summary?: string
  blocks: CanvasBlock[]
}

export interface ReportCanvasRecord {
  id: string
  projectId: string
  sourceAuditId: string
  title: string
  status: CanvasStatus
  currentVersion: number
  createdById: string
  createdAt: Date
  updatedAt: Date
}

export interface CanvasVersionRecord {
  canvasId: string
  version: number
  instruction: string
  document: CanvasDocument
  sourceRefs: CanvasSourceReference[]
  model: string | null
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  createdById: string
  createdAt: Date
}

export interface CanvasEvidenceBundle {
  auditId: string
  projectId: string
  references: CanvasSourceReference[]
  audit: {
    score: number | null
    title: string
  }
  rubrics: Array<{
    refId: string
    rubric: RubricName
    score: number | null
    status: 'PASS' | 'NEEDS_ATTENTION' | 'BLOCKED'
  }>
  flags: Array<{
    refId: string
    id: string
    rank: number
    rubric: RubricName
    severity: SeverityName
    problem: string
    evidence: string
    whyItMatters: string | null
  }>
  captures: Array<{
    refId: string
    id: string
    assetId: string
    label: string
    viewport: 'desktop' | 'mobile'
    phase: 'before' | 'after' | 'observation'
  }>
  memory: Array<{
    refId: string
    id: string
    label: string
    value: string
  }>
}

/** Persistence boundary for immutable Canvas versions. Implement after Prisma lands. */
export interface CanvasRepository {
  createCanvas(input: {
    projectId: string
    sourceAuditId: string
    title: string
    createdById: string
  }): Promise<ReportCanvasRecord>
  getCanvas(id: string): Promise<ReportCanvasRecord | null>
  listCanvases(input: { projectId: string; sourceAuditId?: string }): Promise<ReportCanvasRecord[]>
  listVersions(canvasId: string): Promise<CanvasVersionRecord[]>
  getVersion(canvasId: string, version: number): Promise<CanvasVersionRecord | null>
  appendVersion(input: Omit<CanvasVersionRecord, 'version' | 'createdAt'>): Promise<CanvasVersionRecord>
  markFailed(canvasId: string): Promise<ReportCanvasRecord>
}

export interface CanvasGenerationResult {
  document: CanvasDocument
  sourceRefs: CanvasSourceReference[]
  usage: CanvasGenerationUsage
}

export interface CanvasGenerationUsage {
  model: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

export interface CanvasProviderResult {
  output: unknown
  usage: CanvasGenerationUsage
}

export interface CanvasGenerator {
  generate(input: {
    instruction: string
    evidence: CanvasEvidenceBundle
    previous?: CanvasDocument
  }): Promise<CanvasProviderResult>
}
