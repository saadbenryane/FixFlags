/**
 * Canonical flag types. Every flag-related interface in the codebase extends or
 * projects from these base types. When adding a new field to a flag, update
 * FlagData (or the appropriate base) first, then let TypeScript guide you to
 * every consumer that needs updating.
 *
 * Presentation-layer types (ExplorerFlag, SampleFlagDisplay) remain independent
 * because they rename fields (problem -> title) and add computed display labels.
 * They construct from FlagData/RankableFlag via mapper functions.
 */

import type { EvidenceTarget } from '@/lib/audit/evidence-targets'

/** Tool-specific fix prompts, shared between Flag and ReportRubric models. */
export interface AgentPrompts {
  agentPrompt: string | null
  cursorPrompt: string | null
  claudePrompt: string | null
  windsurfPrompt: string | null
  lovablePrompt: string | null
  boltPrompt: string | null
}

/** Ordered list of agent-prompt keys. Use this to iterate over prompts
 *  instead of listing fields inline (prevents drift when a 6th agent is added). */
export const AGENT_PROMPT_KEYS: (keyof AgentPrompts)[] = [
  'agentPrompt',
  'cursorPrompt',
  'claudePrompt',
  'windsurfPrompt',
  'lovablePrompt',
  'boltPrompt',
]

export type FixConfidence = 'HIGH' | 'MEDIUM' | 'LOW'

export type CauseCertainty = 'REPRODUCED' | 'DETECTED' | 'OBSERVED' | 'LIKELY'

/**
 * The complete set of fields a flag can carry through its lifecycle.
 * Not every interface needs every field: use Pick/Omit to narrow.
 *
 * Uses plain `string` for severity, impactTag, rubric, and source to stay
 * compatible with the widest range of consumers. Prisma enum narrowing
 * happens at the persist boundary (DeterministicFlagRow / AiFlagRow).
 *
 * `id` is optional here because pre-persist shapes (DeterministicFlag) and
 * test fixtures don't always have it. Types that require it (RankableFlag)
 * add it explicitly.
 */
export interface FlagData extends AgentPrompts {
  id?: string
  checkId: string | null
  rubric: string
  severity: string
  impactTag: string | null
  problem: string
  evidence: string
  whyItMatters: string
  fix: string
  confidence: number
  fixConfidence?: FixConfidence
  causeCertainty?: CauseCertainty
  source: string
  pageUrl: string | null
  verificationRule: string | null
  fingerprint: string
  position: number
  evidenceTargets?: unknown
}

/**
 * Pre-persist shape emitted by check modules. Lacks DB identity (id) and
 * enrichment fields (whyItMatters, verificationRule, prompts, fingerprint,
 * position) that are computed or injected later.
 *
 * checkId is always a string here (every check module sets it).
 * impactTag is optional: not all checks set it; the enrichment pipeline adds it.
 * PageUrl is optional because not all checks know the URL at emit time.
 */
export interface DeterministicFlag {
  checkId: string
  rubric: string
  severity: string
  problem: string
  evidence: string
  fix: string
  confidence: number
  source: 'DETERMINISTIC'
  impactTag?: string | null
  pageUrl?: string
  affectedPaths?: string[]
  evidenceTargets?: EvidenceTarget[]
}

/**
 * Post-persist query shape for deterministic flags (includes DB identity and
 * enrichment fields). Narrows severity/impactTag to Prisma enums at the
 * persist boundary for createMany compatibility.
 */
export type DeterministicFlagRow = Omit<FlagData, 'severity' | 'impactTag'> & {
  auditId: string
  pageId: string | null
  rubricId: string | null
  source: 'DETERMINISTIC'
  checkId: string
  severity: import('@prisma/client').Severity
  impactTag: import('@prisma/client').ImpactTag | null
  evidenceTargets?: import('@prisma/client').Prisma.InputJsonValue
  affectedPaths?: import('@prisma/client').Prisma.InputJsonValue
}

/**
 * Post-persist query shape for AI-generated flags.
 */
export type AiFlagRow = Omit<FlagData, 'severity' | 'impactTag'> & {
  auditId: string
  pageId: string | null
  rubricId: string | null
  source: 'AI'
  checkId: null
  severity: import('@prisma/client').Severity
  impactTag: import('@prisma/client').ImpactTag | null
  evidenceTargets?: import('@prisma/client').Prisma.InputJsonValue
  affectedPaths?: import('@prisma/client').Prisma.InputJsonValue
}

/**
 * Shape used for priority ranking and fix-prompt resolution.
 * Required: id, rubric, severity, problem (ranking + display).
 * Optional elsewhere so query rows, fixtures, and MCP payloads can vary.
 * confidence accepts null (Prisma) or undefined (partial fixtures).
 */
export type RankableFlag = Pick<FlagData, 'id' | 'rubric' | 'severity' | 'problem'> &
  Partial<
    Omit<
      FlagData,
      | 'id'
      | 'rubric'
      | 'severity'
      | 'problem'
      | 'confidence'
      | 'fingerprint'
      | 'causeCertainty'
      | 'fixConfidence'
    >
  > & {
    id: string
    confidence?: number | null
    fingerprint?: string | null
    causeCertainty?: CauseCertainty | null
    fixConfidence?: FixConfidence | null
    status?: string | null
    evidenceTargets?: unknown
    affectedPaths?: unknown
  }

/**
 * Minimal subset for AI prescription matching.
 */
export type ExistingFlagForPrescription = Pick<
  FlagData,
  'source' | 'rubric' | 'severity' | 'problem' | 'checkId' | 'evidence' | 'pageUrl'
> & { flagKey: string }

/**
 * Minimal subset for theme-based deduplication matching.
 */
export type ThemeMatchableFlag = Pick<FlagData, 'problem' | 'evidence'> & {
  whyItMatters?: string
}

/**
 * Minimal subset for diff comparison.
 */
export type FlagDiffSummaryItem = Pick<FlagData, 'checkId' | 'problem' | 'rubric' | 'severity'> & {
  status?: string
}

/**
 * Minimal subset for text export.
 */
export type ExportFlag = Pick<FlagData, 'severity' | 'problem'> & {
  rubric?: string
}
