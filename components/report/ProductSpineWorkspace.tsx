'use client'

import { useState, type ReactNode } from 'react'
import { ReportExplorer } from '@/components/report/ReportExplorer'
import { ReportOutcomeBar } from '@/components/report/ReportOutcomeBar'
import { ReportWorkspaceSplitShell } from '@/components/report/ReportWorkspaceSplitShell'
import { WorkspaceChatPanel } from '@/components/report/WorkspaceChatPanel'
import { ReportCanvasPanel } from '@/components/report/ReportCanvasPanel'
import {
  REPORT_SECTION_SCROLL_MT,
  WORKSPACE_REPORT_FRAME_CLASS,
} from '@/components/report/workspace-geometry'
import { REPORT_COPY } from '@/lib/marketing/copy'
import type { PlaybackStep } from '@/lib/audit/playback-steps'
import type { AgentMessage } from '@/lib/audit/agent-message'
import type { ActionTimelineEvent } from '@/lib/audit/action-timeline'
import { buildPlaybackSteps } from '@/lib/audit/playback-steps'
import type { AuditScreenshot } from '@/lib/audit/screenshot-types'
import type { ReportWorkspaceHistoryPoint, ReportWorkspaceModel } from '@/lib/report/workspace-model'
import { cn } from '@/lib/utils'

type ObservationSnapshot = {
  workspace: ReportWorkspaceModel
  url: string
  pageType: string | null
  screenshots: AuditScreenshot[]
  actionTimeline: ActionTimelineEvent[]
  agentMessages: AgentMessage[]
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
 * Product history spine for owners with multiple observations.
 * Owns the single full-bleed split shell; summary lives in Product Report mode.
 */
export function ProductSpineWorkspace({
  reportId,
  history,
  model,
  url,
  screenshots,
  steps,
  agentMessages = [],
  showCanvas = false,
  canUseCanvas = false,
  canChat,
  showChatColumn = true,
  verdict,
  frameExtras,
  flagsSection,
  belowFrame,
  className,
}: {
  reportId: string
  history: ReportWorkspaceHistoryPoint[]
  model: ReportWorkspaceModel
  url: string
  screenshots: AuditScreenshot[]
  steps: PlaybackStep[]
  agentMessages?: AgentMessage[]
  showCanvas?: boolean
  canUseCanvas?: boolean
  canChat?: boolean
  showChatColumn?: boolean
  /** Verdict line for the current observation. */
  verdict?: string | null
  /** Callouts and re-check outcome that sit between the bar and the list. */
  frameExtras?: ReactNode
  /** Fix explorer for the current observation. */
  flagsSection: ReactNode
  /** Polish pass, review context, and toolbar for the current observation. */
  belowFrame?: ReactNode
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
        actionTimeline: payload.observation.actionTimeline ?? [],
        agentMessages: payload.observation.agentMessages ?? [],
      })
    } catch (cause) {
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
  const activeSteps = observation ? buildPlaybackSteps(observation.actionTimeline) : steps
  const activeAgentMessages = observation?.agentMessages ?? agentMessages

  /**
   * Every observation renders the same rows: outcome bar, then the fix list.
   * Only the current observation carries polish pass and review context, so an
   * earlier review never implies context it did not capture.
   */
  const activeFlagsSection = observation ? (
    <section
      id="report-flags"
      className={cn(REPORT_SECTION_SCROLL_MT, 'flex min-h-0 flex-1 flex-col')}
    >
      <ReportExplorer
        model={observation.workspace.explorer}
        aiLocked={false}
        auditId={observation.workspace.identity.auditId ?? undefined}
      />
    </section>
  ) : (
    flagsSection
  )

  const spineReportPanel = (
    <>
      <div data-report-frame className={WORKSPACE_REPORT_FRAME_CLASS}>
        <ReportOutcomeBar
          model={activeModel}
          verdict={observation ? null : verdict}
          historyOverride={history}
          selectedIndex={selectedIndex}
          onSelect={(index) => void selectObservation(index)}
        />
        {observation ? (
          <p className="shrink-0 rounded-card border border-border/45 bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
            {REPORT_COPY.workspace.earlierObservation}
          </p>
        ) : (
          frameExtras
        )}
        {loading ? (
          <p
            role="status"
            className="shrink-0 rounded-card border border-border/40 bg-muted/20 px-4 py-3 text-xs text-muted-foreground"
          >
            {REPORT_COPY.workspace.loadingObservation}
          </p>
        ) : null}
        {error ? (
          <p
            role="status"
            className="shrink-0 rounded-card border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive"
          >
            {error}
          </p>
        ) : null}
        {activeFlagsSection}
      </div>
      {observation ? null : belowFrame}
    </>
  )

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <ReportWorkspaceSplitShell
        showChatColumn={showChatColumn}
        canUseTimeline={canChat}
        showCanvas={showCanvas}
        canUseCanvas={canUseCanvas}
        canvasPanel={canUseCanvas ? <ReportCanvasPanel auditId={activeAuditId} /> : undefined}
        leftPanel={
          <WorkspaceChatPanel
            auditId={reportId}
            observationAuditId={activeAuditId}
            canChat={canChat}
            agentMessages={activeAgentMessages}
            reportUrl={activeUrl}
          />
        }
        browserUrl={activeUrl}
        browserScreenshots={activeScreenshots}
        reportPanel={spineReportPanel}
        steps={activeSteps}
        className="h-full"
      />
    </div>
  )
}
