import { RUBRIC_ORDER, type RubricName } from '@/lib/audit/constants'
import { computeRubricStatus, type RubricStatus } from '@/lib/audit/rubric'
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

export type ReportPromptAccess = 'none' | 'demonstrated' | 'all'

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
    criticalCount: number
    checkedScope: string | null
  }
  summary: {
    score: number | null
    rubrics: ReportWorkspaceRubric[]
    history: ReportWorkspaceHistoryPoint[] | null
  }
  explorer: ReportExplorerModel
  capabilities: {
    promptAccess: ReportPromptAccess
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
  history?: ReportWorkspaceHistoryPoint[]
  checkedScope?: string | null
  canShare?: boolean
  canRecheck?: boolean
  canGiveFeedback?: boolean
  promptAccess?: ReportPromptAccess
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
  const criticalCount = input.explorer.flags.filter(
    (flag) => flag.severity === 'CRITICAL'
  ).length
  const promptAccess = input.promptAccess ?? 'all'

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
      criticalCount,
      checkedScope: input.checkedScope ?? null,
    },
    summary: {
      score: input.explorer.score,
      rubrics,
      history: normalizeWorkspaceHistory(input.history),
    },
    explorer: input.explorer,
    capabilities: {
      promptAccess,
      canCopyPrompts:
        promptAccess !== 'none' &&
        input.explorer.flags.some((flag) => flag.hasFixPrompt),
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
