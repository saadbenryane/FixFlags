import { RUBRIC_ORDER, type RubricName } from '@/lib/audit/constants'
import type { LaunchReadinessValue } from '@/lib/audit/launch-readiness'
import {
  computeRubricStatus,
  type RubricStatus,
  type ShareStatus,
} from '@/lib/audit/rubric'
import type { ReportExplorerModel } from '@/lib/report/explorer-model'
import { rubricLabel } from '@/lib/utils'
import { displayHostname } from '@/lib/utils/url-helpers'

export type ReportWorkspaceKind =
  | 'completed'
  | 'progressive'
  | 'sample'
  | 'dashboard'

export type ReportWorkspaceStatus =
  | 'checking'
  | 'completed'
  | 'partial'
  | 'degraded'
  | 'failed'
  | 'unavailable'

export type ReportWorkspaceReadiness =
  | 'ready'
  | 'fix_first'
  | 'not_ready'
  | 'checking'
  | 'unavailable'

export interface ReportWorkspaceHistoryPoint {
  id: string
  score: number
  checkedAt: Date
}

export interface ReportWorkspaceRubric {
  name: RubricName
  label: string
  status: RubricStatus
  score: number | null
  grade: string | null
  flagCount: number
  criticalCount: number
  importantCount: number
}

export interface ReportWorkspaceModel {
  identity: {
    auditId: string | null
    displayHost: string
    url: string | null
    pageType: string | null
    checkedAt: Date | null
    status: ReportWorkspaceStatus
  }
  outcome: {
    unresolvedCount: number
    highImpactCount: number
    checkedScope: string | null
  }
  summary: {
    readiness: ReportWorkspaceReadiness
    score: number | null
    rubrics: ReportWorkspaceRubric[]
    history: ReportWorkspaceHistoryPoint[] | null
  }
  explorer: ReportExplorerModel
  capabilities: {
    canCopyPrompts: boolean
    canShare: boolean
    canRecheck: boolean
    canGiveFeedback: boolean
    demonstratedFlagId: string | null
  }
  context: {
    kind: ReportWorkspaceKind
    loading: boolean
    recheckOutcome: unknown | null
    degradedReason: string | null
  }
}

export interface BuildReportWorkspaceModelInput {
  kind: ReportWorkspaceKind
  explorer: ReportExplorerModel
  auditId?: string | null
  url?: string | null
  pageType?: string | null
  checkedAt?: Date | null
  status?: ReportWorkspaceStatus
  loading?: boolean
  shareStatus?: ShareStatus | null
  launchReadiness?: LaunchReadinessValue | null
  history?: ReportWorkspaceHistoryPoint[]
  checkedScope?: string | null
  canShare?: boolean
  canRecheck?: boolean
  canGiveFeedback?: boolean
  demonstratedFlagId?: string | null
  recheckOutcome?: unknown | null
  degradedReason?: string | null
}

function scoreRowFor(
  explorer: ReportExplorerModel,
  name: RubricName
): { score: number | null; grade: string | null } {
  const row = explorer.rubricScores.find(
    (candidate) =>
      candidate.name === name ||
      candidate.name.toUpperCase() === name ||
      candidate.name === rubricLabel(name)
  )
  return {
    score: row?.score ?? null,
    grade: row?.grade ?? null,
  }
}

export function buildWorkspaceRubrics(
  explorer: ReportExplorerModel
): ReportWorkspaceRubric[] {
  return RUBRIC_ORDER.map((name) => {
    const flags = explorer.flags.filter((flag) => flag.rubric === name)
    const row = scoreRowFor(explorer, name)
    return {
      name,
      label: rubricLabel(name),
      status: computeRubricStatus({
        name,
        grade: row.grade,
        score: row.score,
        flags: flags.map((flag) => ({ severity: flag.severity })),
      }),
      score: row.score,
      grade: row.grade,
      flagCount: flags.length,
      criticalCount: flags.filter((flag) => flag.severity === 'CRITICAL').length,
      importantCount: flags.filter((flag) => flag.severity === 'IMPORTANT').length,
    }
  })
}

export function resolveWorkspaceReadiness(input: {
  loading?: boolean
  status?: ReportWorkspaceStatus
  shareStatus?: ShareStatus | null
  launchReadiness?: LaunchReadinessValue | null
  rubrics: ReportWorkspaceRubric[]
}): ReportWorkspaceReadiness {
  if (input.loading || input.status === 'checking') return 'checking'
  if (input.status === 'failed' || input.status === 'unavailable') return 'unavailable'
  if (input.launchReadiness === 'not_ready') return 'not_ready'
  if (
    input.launchReadiness === 'fix_first' ||
    input.shareStatus === 'fix_before_sharing' ||
    input.rubrics.some((rubric) => rubric.status === 'BLOCKED')
  ) {
    return 'fix_first'
  }
  if (
    input.launchReadiness === 'safe' ||
    input.shareStatus === 'good_to_share'
  ) {
    return 'ready'
  }
  return input.rubrics.every((rubric) => rubric.score === null)
    ? 'unavailable'
    : 'fix_first'
}

export function normalizeWorkspaceHistory(
  history: ReportWorkspaceHistoryPoint[] | undefined
): ReportWorkspaceHistoryPoint[] | null {
  if (!history || history.length < 2) return null
  return [...history].sort(
    (left, right) => left.checkedAt.getTime() - right.checkedAt.getTime()
  )
}

export function buildReportWorkspaceModel(
  input: BuildReportWorkspaceModelInput
): ReportWorkspaceModel {
  const rubrics = buildWorkspaceRubrics(input.explorer)
  const url = input.url ?? null
  const status = input.status ?? (input.loading ? 'checking' : 'completed')
  const highImpactCount = input.explorer.flags.filter(
    (flag) => flag.severity === 'CRITICAL' || flag.severity === 'IMPORTANT'
  ).length

  return {
    identity: {
      auditId: input.auditId ?? null,
      displayHost:
        input.explorer.displayHost || (url ? displayHostname(url) : 'Report'),
      url,
      pageType: input.pageType ?? input.explorer.pageType,
      checkedAt: input.checkedAt ?? null,
      status,
    },
    outcome: {
      unresolvedCount: input.explorer.flagCount,
      highImpactCount,
      checkedScope: input.checkedScope ?? null,
    },
    summary: {
      readiness: resolveWorkspaceReadiness({
        loading: input.loading,
        status,
        shareStatus: input.shareStatus,
        launchReadiness: input.launchReadiness,
        rubrics,
      }),
      score: input.explorer.score,
      rubrics,
      history: normalizeWorkspaceHistory(input.history),
    },
    explorer: input.explorer,
    capabilities: {
      canCopyPrompts: input.explorer.flags.some((flag) => flag.hasFixPrompt),
      canShare: input.canShare ?? false,
      canRecheck: input.canRecheck ?? false,
      canGiveFeedback: input.canGiveFeedback ?? false,
      demonstratedFlagId: input.demonstratedFlagId ?? null,
    },
    context: {
      kind: input.kind,
      loading: input.loading ?? false,
      recheckOutcome: input.recheckOutcome ?? null,
      degradedReason: input.degradedReason ?? null,
    },
  }
}
