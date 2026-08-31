'use client'

import { useEffect, useMemo, useState } from 'react'
import { ReportWorkspaceSplitShell } from '@/components/report/ReportWorkspaceSplitShell'
import { LiveReportExplorer } from '@/components/audit/LiveReportExplorer'
import { ReportOutcomeBar } from '@/components/report/ReportOutcomeBar'
import { ReportPane } from '@/components/report/ReportPane'
import { WorkspaceChatPanel } from '@/components/report/WorkspaceChatPanel'
import { buildFixFlagsScanMessages } from '@/lib/audit/scan-agent-messages'
import { DEMO_BRAND } from '@/lib/demo/brand'
import type { ReportWorkspaceModel } from '@/lib/report/workspace-model'
import { LANDING_PAGE } from '@/lib/marketing/copy'
import { MeProvider } from '@/hooks/useMe'

const STORY_DURATIONS = [2600, 3000, 3200, 3600, 7000] as const
const STORY_PROGRESS = [24, 46, 62, 82, 100] as const
const LAST_PHASE = STORY_DURATIONS.length - 1

const story = LANDING_PAGE.sampleReport.story

/**
 * Marketing frame keeps its rounded card. Overflow lives on this wrapper so
 * both panes clip to the radius; the editor shell itself stays flush.
 */
const STORY_FRAME_CLASS =
  'isolate overflow-hidden rounded-card bg-background shadow-glass-hero ring-1 ring-border/55 lg:h-[38rem]'

function storyStatus(phase: number): string {
  if (phase === 0) return 'CAPTURING'
  if (phase < 3) return 'CHECKING'
  if (phase === 3) return 'JUDGING'
  return 'COMPLETED'
}

/**
 * Curated homepage emulation of the Agent|Report editor. It replays one
 * snapshot of the demo Product through deterministic scan messages and never
 * starts a real scan. Preview/Timeline playback props are not used.
 */
export function HomepageReportPreview({
  model,
}: {
  model: ReportWorkspaceModel
}) {
  const [phase, setPhase] = useState(0)
  const [playing, setPlaying] = useState(true)

  const selectedFlag =
    model.explorer.flags.find(
      (flag) => flag.id === model.capabilities.demonstratedFlagId,
    ) ??
    model.explorer.flags.find((flag) => flag.severity === 'CRITICAL') ??
    model.explorer.flags[0]

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
        url: 'https://demosite.example',
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
                  fix: selectedFlag.fixPrompt || selectedFlag.copyFixPrompt,
                },
              ]
            : [],
        reportCompleteness: 'FULL',
      }),
    [phase, selectedFlag],
  )

  const capturing = phase < LAST_PHASE && playing

  return (
    <div
      className={STORY_FRAME_CLASS}
      onPointerDown={() => {
        if (!playing) return
        setPlaying(false)
        setPhase(LAST_PHASE)
      }}
    >
      <ReportWorkspaceSplitShell
        ariaLabel={story.label}
        syncViewToUrl={false}
        initialMobileFocus="product"
        scanning={capturing}
        className="h-full min-h-0"
        leftPanel={
          <WorkspaceChatPanel
            capabilities={model.capabilities}
            gateReason="sign-in"
            claimReason="create-account"
            claimNextPath="/samples"
            agentMessages={messages}
            reportUrl={model.identity.url ?? DEMO_BRAND.sampleUrl}
            productName={DEMO_BRAND.displayLabel}
            scanning={capturing}
            showToolbarActions={false}
          />
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
    </div>
  )
}
