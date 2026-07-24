/**
 * Types for the internal knowledge graph.
 *
 * Internal-only by convention. Public pages read from derived read models in
 * `lib/graph/queries.ts`, never from the raw Prisma clients of these tables.
 *
 * See docs/growth/architecture.md for the full design.
 */

export type GraphTechKind =
  | 'framework'
  | 'builder'
  | 'hosting'
  | 'analytics'
  | 'monitoring'
  | 'cms'
  | 'commerce'
  | 'payments'
  | 'support'

export interface SiteSnapshot {
  /** Audit URL - normalized, hostname + protocol only. */
  rootUrl: string
  /** Distinct page URLs discovered during this audit (homepage at minimum). */
  pageUrls: string[]
  /** Page roles as classified by the audit pipeline. */
  pageRoles: Record<string, string>
  /** Detected technologies with confidence in [0, 1]. */
  detectedTech: Array<{
    name: string
    kind: GraphTechKind
    confidence: number
    evidence?: Array<{ type: string; label: string }>
  }>
  /** Only a complete detector run may mark previously current technologies inactive. */
  technologyDetectionComplete: boolean
  /** Industry guess, if we have one yet (otherwise null - learned over time). */
  industryGuess: string | null
}

export interface FlagSnapshot {
  flagId: string
  checkId: string | null
  rubric: string
  fingerprint: string | null
  problem: string
  fix: string
  pageUrl: string | null
  /** Five agent-specific fix prompts as stored on Flag. */
  prompts: {
    generic: string | null
    cursor: string | null
    claude: string | null
    lovable: string | null
    bolt: string | null
  }
}

export interface PersistResult {
  siteId: string
  pageIds: string[]
  issueIds: string[]
  occurrenceCount: number
}
