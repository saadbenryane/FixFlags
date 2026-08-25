'use client'

import { useEffect, useMemo, useState } from 'react'
import { ReportWorkspaceSplitShell } from '@/components/report/ReportWorkspaceSplitShell'
import type { PreviewDevice } from '@/components/report/WorkspaceBrowserPanel'
import type { WorkspacePanelView } from '@/components/report/WorkspaceViewTabs'
import { LiveReportExplorer } from '@/components/audit/LiveReportExplorer'
import { ReportOutcomeBar } from '@/components/report/ReportOutcomeBar'
import { ReportPane } from '@/components/report/ReportPane'
import { WorkspaceChatPanel } from '@/components/report/WorkspaceChatPanel'
import { buildPlaybackSteps } from '@/lib/audit/playback-steps'
import { buildFixFlagsScanMessages } from '@/lib/audit/scan-agent-messages'
import { DEMO_BRAND } from '@/lib/demo/brand'
import { getStaticSampleAudit } from '@/lib/marketing/static-sample'
import { explorerScreenshots } from '@/lib/report/explorer-model'
import type { ReportWorkspaceModel } from '@/lib/report/workspace-model'
import { LANDING_PAGE } from '@/lib/marketing/copy'
import { MeProvider } from '@/hooks/useMe'

const STORY_DURATIONS = [2600, 3000, 3200, 3600, 7000] as const
const STORY_PROGRESS = [24, 46, 62, 82, 100] as const
const LAST_PHASE = STORY_DURATIONS.length - 1

const story = LANDING_PAGE.sampleReport.story

/**
 * Marketing frame keeps its rounded card. The fixed editor height stops the
 * section from jumping when the story swaps the desktop and mobile capture.
 */
const STORY_FRAME_CLASS =
  'rounded-card shadow-glass-hero ring-1 ring-border/55 lg:h-[38rem]'

function storyStatus(phase: number): string {
  if (phase === 0) return 'CAPTURING'
  if (phase < 3) return 'CHECKING'
  if (phase === 3) return 'JUDGING'
  return 'COMPLETED'
}

/**
 * Curated homepage emulation of the living review editor. It replays one
 * snapshot of the demo Product through the deterministic scan messages and
 * never starts a real scan. The first toggle click hands control to the
 * visitor and settles the replay on the completed review.
 */
export function HomepageReportPreview({
  model,
}: {
  model: ReportWorkspaceModel
}) {
  const [phase, setPhase] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [chosenView, setChosenView] = useState<WorkspacePanelView | null>(null)
  const [chosenDevice, setChosenDevice] = useState<PreviewDevice | null>(null)
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null)

  const selectedFlag =
    model.explorer.flags.find(
      (flag) => flag.id === model.capabilities.demonstratedFlagId,
    ) ??
    model.explorer.flags.find((flag) => flag.severity === 'CRITICAL') ??
    model.explorer.flags[0]

  const steps = useMemo(
    () => buildPlaybackSteps(getStaticSampleAudit().actionTimeline ?? []),
    [],
  )

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPhase(LAST_PHASE)
      setPlaying(false)
      return
    }
    if (!playing) return

    const timeout = window.setTimeout(
      () => setPhase((current) => (current + 1) % STORY_DURATIONS.length),
      STORY_DURATIONS[phase],
    )
    return () => window.clearTimeout(timeout)
  }, [phase, playing])

  const messages = useMemo(
    () =>
      buildFixFlagsScanMessages({
        id: 'homepage-product-story',
        status: storyStatus(phase),
        progress: STORY_PROGRESS[phase],
        journeyReviewIncluded: true,
        journeyReviewAt: phase >= 2 ? new Date(0) : null,
        flags:
          phase >= 3 && selectedFlag
            ? [
                {
                  id: selectedFlag.id,
                  problem: selectedFlag.title,
                  rubric: selectedFlag.rubric,
                  severity: selectedFlag.severity,
                  checkId: selectedFlag.checkId,
                  impactTag: selectedFlag.impactTag,
                },
              ]
            : [],
        reportCompleteness: 'FULL',
      }),
    [phase, selectedFlag],
  )

  const screenshots = useMemo(
    () => explorerScreenshots(model.explorer),
    [model.explorer],
  )

  const storyView: WorkspacePanelView = phase >= 3 ? 'report' : 'browser'
  const storyDevice: PreviewDevice =
    phase >= 2 && selectedFlag?.affectedDevices.includes('mobile')
      ? 'mobile'
      : 'desktop'
  const view = chosenView ?? storyView
  const device = chosenDevice ?? storyDevice
  const capturing = phase < LAST_PHASE && playing

  const takeOver = () => {
    if (!playing) return
    setPlaying(false)
    setPhase(LAST_PHASE)
    setChosenView((current) => current ?? view)
  }

  return (
    <ReportWorkspaceSplitShell
      ariaLabel={story.label}
      browserUrl={model.identity.url ?? DEMO_BRAND.sampleUrl}
      browserScreenshots={screenshots}
      controlledDevice={device}
      onDeviceChange={(next) => {
        takeOver()
        setChosenDevice(next)
      }}
      controlledView={view}
      onViewChange={(next) => {
        takeOver()
        setChosenView(next)
      }}
      syncViewToUrl={false}
      initialMobileFocus="product"
      scanning={capturing}
      capabilities={model.capabilities}
      steps={steps}
      activeStepIndex={activeStepIndex}
      onSelectStep={(index) => {
        takeOver()
        setActiveStepIndex((current) => (current === index ? null : index))
        setChosenView('browser')
      }}
      onScrub={(index) => {
        takeOver()
        setActiveStepIndex(index)
        setChosenView('browser')
      }}
      onBackToLive={() => setActiveStepIndex(null)}
      className={STORY_FRAME_CLASS}
      leftPanel={
        <WorkspaceChatPanel
          capabilities={model.capabilities}
          gateReason="owner"
          agentMessages={messages}
          reportUrl={model.identity.url ?? DEMO_BRAND.sampleUrl}
          productName={DEMO_BRAND.displayLabel}
          scanning={capturing}
          showToolbarActions={false}
        />
      }
      previewOverlay={
        phase === 2 && selectedFlag && playing ? (
          <div className="absolute inset-x-6 bottom-6 rounded-[var(--radius-inner)] border-l-2 border-brand bg-background/95 p-4 shadow-raised ring-1 ring-border/55 backdrop-blur motion-safe:animate-soft-reveal sm:inset-x-auto sm:right-6 sm:max-w-sm">
            <p className="text-xs font-semibold uppercase tracking-label text-brand">
              {story.evidenceLabel}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-foreground">
              {selectedFlag.evidence || selectedFlag.whyItMatters}
            </p>
          </div>
        ) : null
      }
      reportHeader={<ReportOutcomeBar model={model} />}
      reportPanel={
        <MeProvider initialUser={null}>
          <ReportPane
            explorer={
              <section
                id="report-flags"
                className="flex min-h-0 flex-1 flex-col"
              >
                <LiveReportExplorer
                  model={model.explorer}
                  aiLocked
                  demonstratedFlagId={
                    model.capabilities.demonstratedFlagId ?? undefined
                  }
                  signUpHref="/sign-in?next=%2Fsamples"
                />
              </section>
            }
          />
        </MeProvider>
      }
    />
  )
}
