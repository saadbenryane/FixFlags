'use client'

import { useState, type ReactNode } from 'react'
import { ReportExplorer } from '@/components/report/ReportExplorer'
import {
  ReportWorkspaceSummary,
} from '@/components/report/ReportWorkspaceChrome'
import { ReportWorkspaceSplitShell } from '@/components/report/ReportWorkspaceSplitShell'
import { WorkspaceChatPanel } from '@/components/report/WorkspaceChatPanel'
import { ReportFixListHeader } from '@/components/report/ReportFixListHeader'
import type { PlaybackStep } from '@/components/report/WorkspacePlaybackStrip'
import type { AgentMessage } from '@/lib/audit/agent-message'
import type { AuditScreenshot } from '@/lib/audit/screenshot-types'
import type { ReportWorkspaceHistoryPoint, ReportWorkspaceModel } from '@/lib/report/workspace-model'
import { cn } from '@/lib/utils'

type ObservationSnapshot = {
  workspace: ReportWorkspaceModel
  url: string
  pageType: string | null
  screenshots: AuditScreenshot[]
}

/** Convert a JSON-round-tripped model back to runtime Dates. */
function rehydrateDates(workspace: ReportWorkspaceModel): ReportWorkspaceModel {
  const toDate = (value: unknown): Date | null => {
    if (value instanceof Date) return value
    if (typeof value === 'string') return new Date(value)
    if (typeof value === 'number') return new Date(value)
    return null
  }
  const checkedAt = toDate(workspace.identity.checkedAt)
  return {
    ...workspace,
    identity: { ...workspace.identity, checkedAt },
    summary: {
      ...workspace.summary,
      history:
        workspace.summary.history?.map((point) => ({
          ...point,
          checkedAt: toDate(point.checkedAt) ?? new Date(),
        })) ?? null,
    },
  }
}

/**
 * The Product-centric workspace for an owner viewing a product with history.
 * One spine at the top lists every observation (product review, update
 * review, watch run). Selecting a bar re-anchors the whole workspace:
 * the summary, browser captures, fix list, and chat context all switch to
 * that moment in the product's history.
 */
export function ProductSpineWorkspace({
  reportId,
  history,
  model,
  url,
  screenshots,
  steps,
  agentMessages = [],
  canChat,
  reportPanel,
  className,
}: {
  reportId: string
  history: ReportWorkspaceHistoryPoint[]
  model: ReportWorkspaceModel
  url: string
  screenshots: AuditScreenshot[]
  steps: PlaybackStep[]
  agentMessages?: AgentMessage[]
  canChat?: boolean
  /** Current-report panel shown when no observation is selected. */
  reportPanel: ReactNode
  className?: string
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(
    history.length > 0 ? history.length - 1 : null
  )
  const [observation, setObservation] = useState<ObservationSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectObservation = async (index: number) => {
    if (index === selectedIndex) return
    const point = history[index]
    if (!point) return
    setSelectedIndex(index)

    // The newest observation is the report itself; no fetch needed.
    if (index === history.length - 1) {
      setObservation(null)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/reports/${point.id}/observation`)
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.observation) {
        throw new Error(payload?.error ?? 'Observation unavailable')
      }
      setObservation({
        workspace: rehydrateDates(payload.observation.workspace),
        url: payload.observation.url,
        pageType: payload.observation.pageType,
        screenshots: payload.observation.screenshots ?? [],
      })
    } catch (cause) {
      // Honest degradation: keep the report view, surface the failure.
      setError(cause instanceof Error ? cause.message : 'Observation unavailable')
      setObservation(null)
    } finally {
      setLoading(false)
    }
  }

  const activeModel = observation ? observation.workspace : model
  const activeAuditId = observation?.workspace.identity.auditId ?? reportId
  const activeUrl = observation?.url ?? url
  const activeScreenshots = observation?.screenshots ?? screenshots

  const activeReportPanel = observation ? (
    <section id="report-flags" className="space-y-3">
      <ReportFixListHeader count={observation.workspace.outcome.unresolvedCount} />
      <ReportExplorer
        model={observation.workspace.explorer}
        variant="live"
        aiLocked={false}
        auditId={observation.workspace.identity.auditId ?? undefined}
      />
    </section>
  ) : (
    reportPanel
  )

  return (
    <div className={cn('space-y-4', className)}>
      <ReportWorkspaceSummary
        model={activeModel}
        historyOverride={history}
        selectedIndex={selectedIndex}
        onSelect={(index) => void selectObservation(index)}
      />
      {loading ? (
        <p
          role="status"
          className="rounded-card border border-border/60 bg-muted/40 px-4 py-3 text-xs text-muted-foreground"
        >
          Loading observation…
        </p>
      ) : null}
      {error ? (
        <p
          role="status"
          className="rounded-card border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive"
        >
          {error}
        </p>
      ) : null}
      <ReportWorkspaceSplitShell
        showChatColumn
        canUseTimeline={canChat}
        leftPanel={
          <WorkspaceChatPanel
            auditId={reportId}
            observationAuditId={activeAuditId}
            canChat={canChat}
            agentMessages={agentMessages}
            reportUrl={activeUrl}
          />
        }
        browserUrl={activeUrl}
        browserScreenshots={activeScreenshots}
        reportPanel={activeReportPanel}
        steps={steps}
      />
    </div>
  )
}
