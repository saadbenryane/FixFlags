import { z } from 'zod'
import { RUBRIC_ORDER } from '@/lib/audit/constants'
import type {
  CanvasDocument,
  CanvasEvidenceBundle,
  CanvasSourceKind,
  CanvasSourceReference,
} from '@/lib/canvas/domain'

const ID_MAX = 160
const SHORT_TEXT_MAX = 240
const LONG_TEXT_MAX = 2_000
const MAX_BLOCKS = 40
const MAX_REFS_PER_BLOCK = 24

const safeText = (max: number) => z.string().trim().min(1).max(max)
const safeId = safeText(ID_MAX).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/)

const sourceRefs = z.array(safeId).max(MAX_REFS_PER_BLOCK)
const blockBase = {
  id: safeId,
  sourceRefIds: sourceRefs,
}

const scoreSummary = z.object({
  ...blockBase,
  type: z.literal('score-summary'),
  score: z.number().int().min(0).max(100),
  label: safeText(SHORT_TEXT_MAX),
}).strict()

const rubricComparison = z.object({
  ...blockBase,
  type: z.literal('rubric-comparison'),
  rubrics: z.array(z.object({
    rubric: z.enum(RUBRIC_ORDER),
    score: z.number().int().min(0).max(100).nullable(),
    status: z.enum(['PASS', 'NEEDS_ATTENTION', 'BLOCKED']),
  }).strict()).min(1).max(3),
}).strict()

const rankedFlags = z.object({
  ...blockBase,
  type: z.literal('ranked-flags'),
  title: safeText(SHORT_TEXT_MAX),
  flagIds: z.array(safeId).min(1).max(20),
}).strict()

const evidenceGallery = z.object({
  ...blockBase,
  type: z.literal('evidence-gallery'),
  title: safeText(SHORT_TEXT_MAX),
  items: z.array(z.object({
    captureRefId: safeId,
    caption: safeText(SHORT_TEXT_MAX),
  }).strict()).min(1).max(12),
}).strict()

const beforeAfter = z.object({
  ...blockBase,
  type: z.literal('before-after'),
  title: safeText(SHORT_TEXT_MAX),
  beforeCaptureRefId: safeId,
  afterCaptureRefId: safeId,
  summary: safeText(LONG_TEXT_MAX),
}).strict()

const productMemory = z.object({
  ...blockBase,
  type: z.literal('product-memory'),
  title: safeText(SHORT_TEXT_MAX),
  memoryRefIds: z.array(safeId).min(1).max(20),
}).strict()

const finishPlan = z.object({
  ...blockBase,
  type: z.literal('finish-plan'),
  title: safeText(SHORT_TEXT_MAX),
  flagIds: z.array(safeId).min(1).max(20),
}).strict()

const heading = z.object({
  ...blockBase,
  type: z.literal('heading'),
  level: z.union([z.literal(2), z.literal(3)]),
  text: safeText(SHORT_TEXT_MAX),
}).strict()

const text = z.object({
  ...blockBase,
  type: z.literal('text'),
  text: safeText(LONG_TEXT_MAX),
}).strict()

const callout = z.object({
  ...blockBase,
  type: z.literal('callout'),
  tone: z.enum(['info', 'success', 'warning']),
  title: safeText(SHORT_TEXT_MAX),
  text: safeText(LONG_TEXT_MAX),
}).strict()

export const canvasDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  title: safeText(SHORT_TEXT_MAX),
  summary: safeText(LONG_TEXT_MAX).optional(),
  blocks: z.array(z.discriminatedUnion('type', [
    scoreSummary,
    rubricComparison,
    rankedFlags,
    evidenceGallery,
    beforeAfter,
    productMemory,
    finishPlan,
    heading,
    text,
    callout,
  ])).min(1).max(MAX_BLOCKS),
}).strict()

export class CanvasValidationError extends Error {
  constructor(
    message: string,
    readonly issues: string[]
  ) {
    super(message)
    this.name = 'CanvasValidationError'
  }
}

const EXECUTABLE_OR_REMOTE_CONTENT = /(?:<\/?[a-z][^>]*>|javascript\s*:|data\s*:|https?:\/\/|@import\b|url\s*\(|<script\b|on[a-z]+\s*=)/i

function collectStrings(value: unknown, output: string[] = []): string[] {
  if (typeof value === 'string') output.push(value)
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, output))
  else if (value && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach((item) => collectStrings(item, output))
  }
  return output
}

function assertSafeRenderContent(document: CanvasDocument): void {
  const unsafe = collectStrings(document).find((value) => EXECUTABLE_OR_REMOTE_CONTENT.test(value))
  if (unsafe) {
    throw new CanvasValidationError('Canvas contains executable or remote content', [
      'Canvas text and identifiers must not contain HTML, scripts, CSS resource syntax, data URLs, or remote URLs.',
    ])
  }
}

function referenceMap(bundle: CanvasEvidenceBundle): Map<string, CanvasSourceReference> {
  const map = new Map<string, CanvasSourceReference>()
  for (const reference of bundle.references) {
    if (map.has(reference.id)) {
      throw new CanvasValidationError('Evidence bundle contains duplicate references', [reference.id])
    }
    if (reference.auditId !== bundle.auditId) {
      throw new CanvasValidationError('Evidence bundle crosses report boundaries', [reference.id])
    }
    map.set(reference.id, reference)
  }
  return map
}

function validateBundleEntities(
  bundle: CanvasEvidenceBundle,
  references: Map<string, CanvasSourceReference>
): void {
  const issues: string[] = []
  const rows: Array<{ refId: string; kind: CanvasSourceKind; entityId?: string }> = [
    ...bundle.rubrics.map((row) => ({ refId: row.refId, kind: 'rubric' as const })),
    ...bundle.flags.map((row) => ({ refId: row.refId, kind: 'flag' as const, entityId: row.id })),
    ...bundle.captures.map((row) => ({ refId: row.refId, kind: 'capture' as const, entityId: row.id })),
    ...bundle.memory.map((row) => ({ refId: row.refId, kind: 'memory' as const, entityId: row.id })),
  ]
  for (const row of rows) {
    const reference = references.get(row.refId)
    if (!reference) issues.push(`Bundle row references missing evidence: ${row.refId}`)
    else if (reference.kind !== row.kind) issues.push(`Bundle row/reference kind mismatch: ${row.refId}`)
    else if (row.entityId && reference.entityId !== row.entityId) issues.push(`Bundle row/reference entity mismatch: ${row.refId}`)
  }
  if (issues.length > 0) throw new CanvasValidationError('Evidence bundle is internally inconsistent', issues)
}

function requireKinds(
  ids: string[],
  allowed: CanvasSourceKind[],
  references: Map<string, CanvasSourceReference>,
  context: string,
  issues: string[]
): void {
  for (const id of ids) {
    const reference = references.get(id)
    if (!reference) issues.push(`${context} references inaccessible evidence: ${id}`)
    else if (!allowed.includes(reference.kind)) issues.push(`${context} references ${reference.kind}, expected ${allowed.join(' or ')}: ${id}`)
  }
}

export function validateCanvasDocument(raw: unknown, bundle: CanvasEvidenceBundle): CanvasDocument {
  const parsed = canvasDocumentSchema.safeParse(raw)
  if (!parsed.success) {
    throw new CanvasValidationError(
      'Canvas document does not match schema version 1',
      parsed.error.issues.map((issue) => `${issue.path.join('.') || 'document'}: ${issue.message}`)
    )
  }

  const document = parsed.data as CanvasDocument
  assertSafeRenderContent(document)
  const references = referenceMap(bundle)
  validateBundleEntities(bundle, references)
  const issues: string[] = []
  const blockIds = new Set<string>()

  for (const block of document.blocks) {
    if (blockIds.has(block.id)) issues.push(`Duplicate block id: ${block.id}`)
    blockIds.add(block.id)
    requireKinds(block.sourceRefIds, ['audit', 'rubric', 'flag', 'capture', 'memory'], references, block.id, issues)

    if ((block.type === 'text' || block.type === 'callout') && block.sourceRefIds.length === 0) {
      issues.push(`${block.id} must cite evidence`)
    }
    if (block.type === 'score-summary') {
      requireKinds(block.sourceRefIds, ['audit'], references, block.id, issues)
      if (bundle.audit.score === null || block.score !== bundle.audit.score) {
        issues.push(`${block.id} score does not match report evidence`)
      }
    }
    if (block.type === 'rubric-comparison') {
      requireKinds(block.sourceRefIds, ['rubric'], references, block.id, issues)
      for (const rubric of block.rubrics) {
        const source = bundle.rubrics.find((row) => row.rubric === rubric.rubric)
        if (!source || source.score !== rubric.score || source.status !== rubric.status) {
          issues.push(`${block.id} ${rubric.rubric} result does not match report evidence`)
        } else if (!block.sourceRefIds.includes(source.refId)) {
          issues.push(`${block.id} does not cite its ${rubric.rubric} evidence`)
        }
      }
    }
    if (block.type === 'ranked-flags' || block.type === 'finish-plan') {
      const ids = block.flagIds.map((id) => bundle.flags.find((flag) => flag.id === id)?.refId ?? id)
      requireKinds(ids, ['flag'], references, block.id, issues)
      for (const id of ids) {
        if (!block.sourceRefIds.includes(id)) issues.push(`${block.id} does not cite Flag evidence: ${id}`)
      }
      if (block.type === 'ranked-flags') {
        const ranks = block.flagIds.map((id) => bundle.flags.find((flag) => flag.id === id)?.rank ?? Number.MAX_SAFE_INTEGER)
        if (ranks.some((rank, index) => index > 0 && rank < ranks[index - 1])) {
          issues.push(`${block.id} Flags are not in canonical report rank order`)
        }
      }
    }
    if (block.type === 'evidence-gallery') {
      requireKinds(block.items.map((item) => item.captureRefId), ['capture'], references, block.id, issues)
    }
    if (block.type === 'before-after') {
      requireKinds([block.beforeCaptureRefId, block.afterCaptureRefId], ['capture'], references, block.id, issues)
      const before = bundle.captures.find((capture) => capture.refId === block.beforeCaptureRefId)
      const after = bundle.captures.find((capture) => capture.refId === block.afterCaptureRefId)
      if (before?.phase !== 'before') issues.push(`${block.id} before evidence is not a before capture`)
      if (after?.phase !== 'after') issues.push(`${block.id} after evidence is not an after capture`)
    }
    if (block.type === 'product-memory') requireKinds(block.memoryRefIds, ['memory'], references, block.id, issues)
    if (block.type === 'product-memory') {
      for (const id of block.memoryRefIds) {
        if (!block.sourceRefIds.includes(id)) issues.push(`${block.id} does not cite Product Memory evidence: ${id}`)
      }
    }
  }

  if (issues.length > 0) throw new CanvasValidationError('Canvas references invalid or inaccessible evidence', issues)
  return document
}

/** A renderer may consume only validated documents plus opaque, server-authorized assets. */
export interface SafeCanvasRenderInput {
  document: CanvasDocument
  assetsByCaptureRef: Readonly<Record<string, { assetId: string; alt: string }>>
}
