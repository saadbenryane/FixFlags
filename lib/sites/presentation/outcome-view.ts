import type { Prisma } from '@prisma/client'
import { assessmentIsComparable, type CurrentBindingRevision } from '@/lib/sites/domain/assessment-comparability'
import { currentOutcomeState, UNASSESSED_OUTCOME_SUMMARY, type CustomerOutcomeState } from '@/lib/sites/outcome-state'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'

export type OutcomeViewSource = {
  id: string
  projectId?: string | null
  name: string
  slug: string
  description: string | null
  inferenceSource: string
  confirmedAt: Date | null
  pages: Array<{ pageId: string }>
  kind: 'GENERIC' | 'CHECKOUT' | 'SIGNUP' | 'LOGIN' | 'PASSWORD_RESET' | 'AVAILABILITY'
  criticality: 'CRITICAL' | 'IMPORTANT' | 'INFORMATIONAL'
  environment: string
  enabled: boolean
  staleAfterMinutes: number
  expectation: string | null
  bindings: Array<{ key: string; required: boolean; scope: Prisma.JsonValue | null; mechanism: string; version: number; config?: Prisma.JsonValue }>
  assessments: Array<{
    state: 'CLEAR' | 'FLAG' | 'COULD_NOT_VERIFY'
    summary: string
    assessedAt: Date
    validUntil: Date
    improvementId: string | null
    runRequestId: string
    coverage: Prisma.JsonValue | null
  }>
  runSelections: Array<{ runRequest: { id: string; status: string } }>
}

export type SiteOutcomeView = {
  id: string
  name: string
  slug: string
  description: string | null
  inferenceSource: 'heuristic' | 'browser' | 'user'
  confirmedAt: string | null
  pageIds: string[]
  pageUrls: string[]
  kind: 'GENERIC' | 'CHECKOUT' | 'SIGNUP' | 'LOGIN' | 'PASSWORD_RESET' | 'AVAILABILITY'
  criticality: 'CRITICAL' | 'IMPORTANT' | 'INFORMATIONAL'
  environment: string
  enabled: boolean
  staleAfterMinutes: number
  expectation: string | null
  bindings: Array<{ key: string; required: boolean; scope: Prisma.JsonValue | null; mechanism: string; version: number }>
  coverage: Prisma.JsonValue | null
  state: CustomerOutcomeState
  summary: string
  lastVerifiedAt: string | null
  validUntil: string | null
  flagId: string | null
  latestRunId: string | null
  running: boolean
}

export function projectOutcomeView(row: OutcomeViewSource, context: {
  bindingRevisions: CurrentBindingRevision[]
  pageUrls: string[]
  now: Date
}): SiteOutcomeView {
  const pageIds = row.pages.map((p) => p.pageId)
  const latest = row.assessments[0] ?? null
  const revisions = context.bindingRevisions
  const comparable = latest && assessmentIsComparable(latest.coverage, revisions, row.environment)
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    inferenceSource:
      row.inferenceSource === 'user'
        ? 'user'
        : row.inferenceSource === 'browser'
          ? 'browser'
          : 'heuristic',
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    pageIds,
    pageUrls: context.pageUrls,
    kind: row.kind,
    criticality: row.criticality,
    environment: row.environment,
    enabled: row.enabled,
    staleAfterMinutes: row.staleAfterMinutes,
    expectation: row.expectation,
    bindings: row.bindings.map((binding) => ({
      key: binding.key,
      required: binding.required,
      scope: binding.scope,
      mechanism: binding.mechanism,
      version: binding.version,
    })),
    coverage: latest?.coverage ?? null,
    state: latest && !comparable ? 'COULD_NOT_VERIFY' : currentOutcomeState(latest, context.now),
    summary: latest && !comparable ? SITE_ACTION_COPY.configurationUnknown : latest?.summary ?? UNASSESSED_OUTCOME_SUMMARY,
    lastVerifiedAt: comparable ? latest.assessedAt.toISOString() : null,
    validUntil: comparable ? latest.validUntil.toISOString() : null,
    flagId: latest?.improvementId ?? null,
    latestRunId: row.runSelections[0]?.runRequest.id ?? latest?.runRequestId ?? null,
    running: row.runSelections.some(
      ({ runRequest }) => runRequest.status === 'QUEUED' || runRequest.status === 'RUNNING',
    ),
  }
}
