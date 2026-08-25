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

export interface ReportWorkspaceCapabilities {
  promptAccess: ReportPromptAccess
  canCopyPrompts: boolean
  canReplayTimeline: boolean
  canChat: boolean
  canUseCanvas: boolean
  canShare: boolean
  canExport: boolean
  canRecheck: boolean
  canGiveFeedback: boolean
  demonstratedFlagId: string | null
}

export type ReportWorkspaceCapabilityInput = Omit<
  ReportWorkspaceCapabilities,
  'canCopyPrompts'
>

export type ReportWorkspaceHistoryPoint = {
  id: string
  /** Canonical destination for the complete Review. */
  href: string
  score: number | null
  checkedAt: Date
  /** Observation kind: 'product-review' | 'update-review' | 'watch' */
  kind: 'product-review' | 'update-review' | 'watch'
  /** Capture status for this observation */
  status: 'completed' | 'partial' | 'degraded' | 'failed'
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
  }
  summary: {
    score: number | null
    rubrics: ReportWorkspaceRubric[]
    history: ReportWorkspaceHistoryPoint[] | null
  }
  explorer: ReportExplorerModel
  capabilities: ReportWorkspaceCapabilities
  context: {
    kind: ReportWorkspaceKind
    loading: boolean
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
  capabilities: ReportWorkspaceCapabilityInput
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
  if (!history || history.length === 0) return null
  return [...history].sort(
    (left, right) => left.checkedAt.getTime() - right.checkedAt.getTime()
  )
}

/**
 * Turn a completed audit row into a spine history point.
 * The observation kind is derived from real audit fields, never guessed:
 * a root check is a product review, a WATCH-triggered re-check is a watch
 * run, and any other re-check is an update review.
 */
export function historyPointFromAudit(row: {
  id: string
  href?: string
  score: number | null
  checkedAt: Date
  parentId: string | null
  recheckTrigger: string | null
}): ReportWorkspaceHistoryPoint {
  const kind: ReportWorkspaceHistoryPoint['kind'] =
    row.parentId == null
      ? 'product-review'
      : row.recheckTrigger === 'WATCH'
        ? 'watch'
        : 'update-review'
  return {
    id: row.id,
    href: row.href ?? `/report/${encodeURIComponent(row.id)}?view=report`,
    score: row.score,
    checkedAt: row.checkedAt,
    kind,
    // Loaders pass completed rows only; partial/degraded/failed observations
    // are honest future states, not faked present ones.
    status: 'completed',
  }
}

export function buildReportWorkspaceModel(
  input: BuildReportWorkspaceModelInput
): ReportWorkspaceModel {
  const rubrics = buildWorkspaceRubrics(input.explorer)
  const url = input.url ?? null
  const status = input.status ?? (input.loading ? 'checking' : 'completed')
  const promptAccess = input.capabilities.promptAccess

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
      canReplayTimeline: input.capabilities.canReplayTimeline,
      canChat: input.capabilities.canChat,
      canUseCanvas: input.capabilities.canUseCanvas,
      canShare: input.capabilities.canShare,
      canExport: input.capabilities.canExport,
      canRecheck: input.capabilities.canRecheck,
      canGiveFeedback: input.capabilities.canGiveFeedback,
      demonstratedFlagId: input.capabilities.demonstratedFlagId,
    },
    context: {
      kind: input.kind,
      loading: input.loading ?? false,
    },
  }
}
