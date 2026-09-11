import type { AgentMessage } from '@/lib/audit/agent-message'
import type { AuditAccessContext } from '@/lib/audit/access-context'
import {
  resolveReportSurfaceCapabilities,
  type ReportPromptProjection,
} from '@/lib/audit/access-capabilities'
import type { ReviewCapabilities } from '@/lib/auth/review-access-policy'
import type { ReportExplorerModel } from '@/lib/report/explorer-model'
import {
  buildReportWorkspaceModel,
  type ReportWorkspaceHistoryPoint,
  type ReportWorkspaceModel,
  type ReportWorkspaceUpdateDiff,
} from '@/lib/report/workspace-model'

export type ReviewWorkspaceState =
  | 'running'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'sample'

export type ReviewWorkspaceProjection =
  | {
      kind: 'forbidden'
      capabilities: ReviewCapabilities
    }
  | ReviewWorkspaceVisibleProjection

export interface ReviewWorkspaceVisibleProjection {
  kind: ReviewWorkspaceState
  review: {
    id: string | null
    parentId: string | null
    url: string | null
    pageType: string | null
    checkedAt: Date | null
    freshComparableUpdate: boolean
  }
  visibility: Exclude<AuditAccessContext, 'denied'> | 'curated_sample'
  capabilities: ReviewCapabilities
  prompt: ReportPromptProjection
  chat: ReturnType<typeof resolveReportSurfaceCapabilities>['chat']
  workspace: ReportWorkspaceModel
  explorer: ReportExplorerModel
  agentMessages: AgentMessage[]
  dataGaps: string[]
}

export interface BuildReviewWorkspaceProjectionInput {
  kind: ReviewWorkspaceState
  explorer: ReportExplorerModel
  visibility: Exclude<AuditAccessContext, 'denied'> | 'curated_sample'
  isAuthenticated: boolean
  reviewId?: string | null
  parentId?: string | null
  url?: string | null
  pageType?: string | null
  checkedAt?: Date | null
  freshComparableUpdate?: boolean
  loading?: boolean
  history?: ReportWorkspaceHistoryPoint[]
  updateDiff?: ReportWorkspaceUpdateDiff | null
  demonstratedFlagId?: string | null
  agentMessages?: AgentMessage[]
  dataGaps?: string[]
}

/**
 * Canonical, redaction-safe projection for every visible Review surface.
 * Components consume this object and never infer access from raw audit rows.
 */
export function buildReviewWorkspaceProjection(
  input: BuildReviewWorkspaceProjectionInput
): ReviewWorkspaceVisibleProjection {
  const isSample = input.kind === 'sample'
  const surface = resolveReportSurfaceCapabilities({
    accessContext: input.visibility,
    isLoggedIn: input.isAuthenticated,
    isRepositorySample: isSample,
  })
  const reviewId = input.reviewId ?? null
  const workspace = buildReportWorkspaceModel({
    kind:
      input.kind === 'running' || input.kind === 'failed'
        ? 'progressive'
        : input.kind === 'sample'
          ? 'sample'
          : 'completed',
    explorer: input.explorer,
    auditId: reviewId,
    url: input.url,
    pageType: input.pageType,
    checkedAt: input.checkedAt,
    status:
      input.kind === 'running'
        ? 'checking'
        : input.kind === 'failed'
          ? 'failed'
          : input.kind === 'partial'
            ? 'partial'
            : 'completed',
    loading: input.loading ?? input.kind === 'running',
    history: input.history,
    updateDiff: input.updateDiff,
    capabilities: {
      promptAccess: surface.prompt.workspace,
      canReplayTimeline: false,
      canChat: !isSample && surface.chat.canChat && Boolean(reviewId),
      canUseCanvas: false,
      canShare: !isSample && surface.capabilities.canMutateLifecycle,
      canExport: !isSample && surface.capabilities.canExport,
      canRecheck: !isSample && surface.capabilities.canRunUpdateReview,
      canGiveFeedback: !isSample && surface.capabilities.canMutateLifecycle,
      demonstratedFlagId: input.demonstratedFlagId ?? null,
    },
  })

  return {
    kind: input.kind,
    review: {
      id: reviewId,
      parentId: input.parentId ?? null,
      url: input.url ?? null,
      pageType: input.pageType ?? null,
      checkedAt: input.checkedAt ?? null,
      freshComparableUpdate: input.freshComparableUpdate ?? false,
    },
    visibility: input.visibility,
    capabilities: surface.capabilities,
    prompt: surface.prompt,
    chat: surface.chat,
    workspace,
    explorer: workspace.explorer,
    agentMessages: input.agentMessages ?? [],
    dataGaps: input.dataGaps ?? [],
  }
}

export function buildForbiddenReviewWorkspaceProjection(): ReviewWorkspaceProjection {
  return {
    kind: 'forbidden',
    capabilities: resolveReportSurfaceCapabilities({
      accessContext: null,
      isLoggedIn: false,
    }).capabilities,
  }
}
