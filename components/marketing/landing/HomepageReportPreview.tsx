'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ArrowUp } from 'lucide-react'
import {
  LivingReviewEmulation,
  type LivingReviewDevice,
  type LivingReviewView,
} from '@/components/report/LivingReviewEmulation'
import { LiveReportExplorer } from '@/components/audit/LiveReportExplorer'
import { ReportOutcomeBar } from '@/components/report/ReportOutcomeBar'
import { WORKSPACE_REPORT_FRAME_CLASS } from '@/components/report/workspace-geometry'
import { WorkspaceTranscript } from '@/components/report/WorkspaceTranscript'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { buildPlaybackSteps } from '@/lib/audit/playback-steps'
import { buildFixFlagsScanMessages } from '@/lib/audit/scan-agent-messages'
import { DEMO_BRAND } from '@/lib/demo/brand'
import { getStaticSampleAudit } from '@/lib/marketing/static-sample'
import { explorerScreenshots } from '@/lib/report/explorer-model'
import type { ReportWorkspaceModel } from '@/lib/report/workspace-model'
import { HERO, LANDING_PAGE, REPORT_COPY } from '@/lib/marketing/copy'
import { MeProvider } from '@/hooks/useMe'

const STORY_DURATIONS = [2600, 3000, 3200, 3600, 7000] as const
const STORY_PROGRESS = [24, 46, 62, 82, 100] as const
const LAST_PHASE = STORY_DURATIONS.length - 1

const story = LANDING_PAGE.sampleReport.story
const chatCopy = REPORT_COPY.workspace.chat

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
export function HomepageReportPreview({ model }: { model: ReportWorkspaceModel }) {
  const [phase, setPhase] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [chosenView, setChosenView] = useState<LivingReviewView | null>(null)
  const [chosenDevice, setChosenDevice] = useState<LivingReviewDevice | null>(null)
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null)
  const [composerDraft, setComposerDraft] = useState('')

  const selectedFlag =
    model.explorer.flags.find((flag) => flag.id === model.capabilities.demonstratedFlagId) ??
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
            ? [{ id: selectedFlag.id, problem: selectedFlag.title, rubric: selectedFlag.rubric }]
            : [],
        reportCompleteness: 'FULL',
      }),
    [phase, selectedFlag],
  )

  const screenshots = useMemo(() => explorerScreenshots(model.explorer), [model.explorer])

  const storyView: LivingReviewView = phase >= 3 ? 'report' : 'browser'
  const storyDevice: LivingReviewDevice =
    phase >= 2 && selectedFlag?.affectedDevices.includes('mobile') ? 'mobile' : 'desktop'
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
    <LivingReviewEmulation
      label={story.label}
      productName={DEMO_BRAND.displayLabel}
      productHost={DEMO_BRAND.domainLabel}
      browserUrl={model.identity.url ?? DEMO_BRAND.sampleUrl}
      screenshots={screenshots}
      device={device}
      onDeviceChange={(next) => {
        takeOver()
        setChosenDevice(next)
      }}
      view={view}
      onViewChange={(next) => {
        takeOver()
        setChosenView(next)
      }}
      capturing={capturing}
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
      transcript={<WorkspaceTranscript messages={messages} linkFlags={false} />}
      composer={
        <form
          className="border-t border-border/40 p-2"
          onSubmit={(event) => {
            event.preventDefault()
            takeOver()
            window.location.assign('/sign-in?next=%2Fsamples')
          }}
        >
          <div className="flex items-center gap-2">
            <Input
              value={composerDraft}
              onChange={(event) => {
                takeOver()
                setComposerDraft(event.target.value)
              }}
              placeholder={chatCopy.authBody}
              className="min-h-11 flex-1 text-sm"
              aria-label={chatCopy.placeholder}
            />
            <Button
              type="submit"
              size="icon"
              className="h-11 w-11 shrink-0"
              disabled={!composerDraft.trim()}
              aria-label={chatCopy.notSignedIn}
            >
              <ArrowUp className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </form>
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
      reportPanel={
        <MeProvider initialUser={null}>
          <div data-report-frame className={WORKSPACE_REPORT_FRAME_CLASS}>
            <ReportOutcomeBar model={model} />
            <section id="report-flags" className="flex min-h-0 flex-1 flex-col">
              <LiveReportExplorer
                model={model.explorer}
                aiLocked
                demonstratedFlagId={model.capabilities.demonstratedFlagId ?? undefined}
                signUpHref="/sign-in?next=%2Fsamples"
              />
            </section>
          </div>
        </MeProvider>
      }
      footer={
        <Link
          href="/#audit"
          className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] bg-foreground px-4 text-xs font-semibold text-background shadow-raised transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          {HERO.primaryCta}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      }
    />
  )
}
