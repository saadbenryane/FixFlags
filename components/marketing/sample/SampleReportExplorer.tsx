'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Smartphone,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { BrowserFrame } from '@/components/audit/BrowserFrame'
import { PromptActionRow } from '@/components/audit/PromptActionRow'
import { ScanTimeline } from '@/components/marketing/sample/ScanTimeline'
import { ScoreRingGauge } from '@/components/marketing/sample/ScoreRingGauge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type {
  DesignTier,
  PipelineStep,
  SampleFlagDisplay,
  SampleReportDisplay,
} from '@/lib/marketing/sample-report-display'
import { scoreToScanColor } from '@/lib/marketing/scan-score-color'
import { cn } from '@/lib/utils'

type ExplorerVariant = 'page' | 'embedded' | 'hero'

interface SampleReportExplorerProps {
  report: SampleReportDisplay
  variant?: ExplorerVariant
  className?: string
  /** Start on a specific flag (0-based) */
  initialFlagIndex?: number
}

function StepDot({ state }: { state: PipelineStep['state'] }) {
  if (state === 'done') {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
        <Check className="h-3 w-3" aria-hidden />
      </span>
    )
  }
  if (state === 'active') {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/15">
        <span className="h-2 w-2 rounded-full bg-brand motion-safe:animate-pulse" />
      </span>
    )
  }
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted">
      <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
    </span>
  )
}

function PipelineStepsList({ steps }: { steps: PipelineStep[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((step) => (
        <li key={step.id} className="flex items-center gap-3">
          <StepDot state={step.state} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  'text-sm',
                  step.state === 'done' && 'text-muted-foreground line-through',
                  step.state === 'active' && 'font-semibold text-foreground',
                  step.state === 'pending' && 'text-muted-foreground/50'
                )}
              >
                {step.label}
              </span>
              {step.state === 'active' ? (
                <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-brand-foreground">
                  {step.detail}
                </span>
              ) : (
                <span
                  className={cn(
                    'shrink-0 text-[11px]',
                    step.state === 'done' ? 'text-muted-foreground' : 'text-muted-foreground/40'
                  )}
                >
                  {step.detail}
                </span>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}

function RubricPills({ scores }: { scores: SampleReportDisplay['rubricScores'] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {scores.map((rubric) => (
        <div
          key={rubric.name}
          className="min-w-[4.5rem] rounded-card bg-muted/30 px-2.5 py-2 shadow-sm"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono text-sm font-bold tabular-nums">{rubric.score}</span>
            <span className="text-[10px] font-medium text-muted-foreground">{rubric.name}</span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted/50">
            <div
              className="h-full rounded-full motion-safe:transition-all motion-safe:duration-500"
              style={{
                width: `${Math.min(100, rubric.score)}%`,
                backgroundColor: scoreToScanColor(rubric.score),
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function GuidelineChecks({ guidelines }: { guidelines: SampleFlagDisplay['guidelines'] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {guidelines.map((g) => (
        <li
          key={g.id}
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium',
            g.passed
              ? 'bg-success/10 text-success'
              : 'bg-destructive/10 text-destructive'
          )}
        >
          {g.passed ? (
            <Check className="h-3 w-3 shrink-0" aria-hidden />
          ) : (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden />
          )}
          {g.label}
        </li>
      ))}
    </ul>
  )
}

function DesignTierPicker({
  tiers,
  activeTier,
  onChange,
}: {
  tiers: SampleFlagDisplay['designTiers']
  activeTier: DesignTier
  onChange: (tier: DesignTier) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tiers.map((tier) => (
        <button
          key={tier.tier}
          type="button"
          onClick={() => onChange(tier.tier)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
            activeTier === tier.tier
              ? tier.tier === 'award'
                ? 'bg-brand text-brand-foreground shadow-sm'
                : 'bg-foreground text-background'
              : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          {tier.tier === 'award' && <Sparkles className="h-3 w-3" aria-hidden />}
          {tier.tier === 'great' && <Wand2 className="h-3 w-3" aria-hidden />}
          {tier.label}
        </button>
      ))}
    </div>
  )
}

function FlagNavigation({
  index,
  total,
  onPrevious,
  onNext,
}: {
  index: number
  total: number
  onPrevious: () => void
  onNext: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
        {index + 1} / {total}
      </span>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9"
          onClick={onPrevious}
          aria-label="Previous flag"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9"
          onClick={onNext}
          aria-label="Next flag"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function ScreenshotPanel({
  report,
  preferredDevice,
}: {
  report: SampleReportDisplay
  preferredDevice: 'desktop' | 'mobile'
}) {
  const defaultTab = preferredDevice === 'mobile' && report.mobileScreenshot ? 'mobile' : 'desktop'

  return (
    <div className="space-y-3">
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 rounded-full bg-muted/50 p-1">
          <TabsTrigger value="desktop" className="gap-1.5 rounded-full text-xs">
            <Monitor className="h-3.5 w-3.5" aria-hidden />
            Desktop
          </TabsTrigger>
          <TabsTrigger value="mobile" className="gap-1.5 rounded-full text-xs">
            <Smartphone className="h-3.5 w-3.5" aria-hidden />
            Mobile
          </TabsTrigger>
        </TabsList>
        <TabsContent value="desktop" className="mt-3">
          <BrowserFrame
            url={report.url}
            imageUrl={report.desktopScreenshot}
            device="desktop"
            alt={`Desktop screenshot of ${report.host}`}
          />
        </TabsContent>
        <TabsContent value="mobile" className="mt-3">
          <div className="mx-auto max-w-[240px]">
            <BrowserFrame
              url={report.url}
              imageUrl={report.mobileScreenshot}
              device="mobile"
              alt={`Mobile screenshot of ${report.host}`}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function FlagDetailPanel({
  flag,
  designTier,
  onDesignTierChange,
}: {
  flag: SampleFlagDisplay
  designTier: DesignTier
  onDesignTierChange: (tier: DesignTier) => void
}) {
  const activeSuggestion =
    flag.designTiers.find((t) => t.tier === designTier) ?? flag.designTiers[0]

  return (
    <div key={flag.id} className="space-y-4 animate-soft-reveal" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-foreground">
          {flag.rubricLabel}
        </span>
        <span
          className={cn(
            'rounded-full px-2.5 py-1 text-[11px] font-semibold',
            flag.severity === 'CRITICAL'
              ? 'bg-destructive/10 text-destructive'
              : flag.severity === 'IMPORTANT'
                ? 'bg-brand/10 text-brand'
                : 'bg-muted text-muted-foreground'
          )}
        >
          {flag.severityLabel}
        </span>
        {flag.impactTag && (
          <span className="rounded-full border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground">
            {flag.impactTag}
          </span>
        )}
      </div>

      <div>
        <h3 className="text-base font-semibold leading-snug text-balance sm:text-lg">
          {flag.title}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty">
          {flag.description}
        </p>
      </div>

      {flag.evidence && (
        <div className="space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
            Evidence
          </p>
          <p className="rounded-card bg-muted/40 px-3 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
            {flag.evidence}
          </p>
        </div>
      )}

      {flag.verificationSteps.length > 0 && (
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
            Steps
          </p>
          <ol className="space-y-1.5">
            {flag.verificationSteps.map((step, i) => (
              <li
                key={i}
                className="flex gap-2 text-sm leading-relaxed text-muted-foreground"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[10px] font-semibold text-foreground">
                  {i + 1}
                </span>
                <span className="text-pretty">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="space-y-3 rounded-card bg-muted/30 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
            Suggestion · upgrade yourself
          </p>
          <DesignTierPicker
            tiers={flag.designTiers}
            activeTier={designTier}
            onChange={onDesignTierChange}
          />
        </div>
        <p className="text-sm leading-relaxed text-foreground/90 text-pretty">
          {activeSuggestion?.suggestion}
        </p>
        <PromptActionRow prompt={activeSuggestion?.suggestion ?? ''} showCursorAction />
      </div>

      <div className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
          UI guidelines
        </p>
        <GuidelineChecks guidelines={flag.guidelines} />
      </div>
    </div>
  )
}

export function SampleReportExplorer({
  report,
  variant = 'page',
  className,
  initialFlagIndex = 0,
}: SampleReportExplorerProps) {
  const [flagIndex, setFlagIndex] = useState(initialFlagIndex)
  const [designTier, setDesignTier] = useState<DesignTier>('good')
  const flagCount = report.flags.length
  const currentFlag = report.flags[flagIndex]

  const showPrevious = useCallback(() => {
    setFlagIndex((i) => (i - 1 + flagCount) % flagCount)
    setDesignTier('good')
  }, [flagCount])

  const showNext = useCallback(() => {
    setFlagIndex((i) => (i + 1) % flagCount)
    setDesignTier('good')
  }, [flagCount])

  const goToFlag = useCallback(
    (index: number) => {
      if (index >= 0 && index < flagCount) {
        setFlagIndex(index)
        setDesignTier('good')
      }
    },
    [flagCount]
  )

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') showPrevious()
      if (e.key === 'ArrowRight') showNext()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showNext, showPrevious])

  if (!currentFlag) return null

  const shellClass = cn(
    'overflow-hidden rounded-card glass-surface shadow-card',
    variant === 'hero' && 'shadow-2xl',
    className
  )

  if (variant === 'hero') {
    return (
      <div className={shellClass}>
        <div className="flex items-center gap-2 border-b border-border/30 px-4 py-3">
          <div className="flex gap-1.5" aria-hidden>
            <span className="h-3 w-3 rounded-full bg-muted-foreground/20" />
            <span className="h-3 w-3 rounded-full bg-muted-foreground/20" />
            <span className="h-3 w-3 rounded-full bg-muted-foreground/20" />
          </div>
          <div className="mx-auto flex items-center gap-2 rounded-full bg-muted/50 px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-success" aria-hidden />
            <span className="font-mono text-[11px] text-muted-foreground">{report.host}</span>
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[1fr_0.75fr_1.1fr]">
          <div className="border-b border-border/30 p-4 sm:p-5 lg:border-b-0 lg:border-r">
            <ScreenshotPanel report={report} preferredDevice={currentFlag.preferredDevice} />
          </div>

          <div className="space-y-5 border-b border-border/30 bg-muted/15 p-4 sm:p-5 lg:border-b-0 lg:border-r">
            <div className="flex items-start gap-4">
              <ScoreRingGauge
                score={report.score}
                grade={report.grade}
                size="md"
                label="Overall"
              />
              <div className="min-w-0 flex-1 space-y-2">
                {report.verdict && (
                  <p className="text-sm font-medium leading-snug text-balance">{report.verdict}</p>
                )}
                <RubricPills scores={report.rubricScores} />
              </div>
            </div>
            <div>
              <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                Review progress
              </p>
              <PipelineStepsList steps={report.pipelineSteps} />
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <div className="mb-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                  Flag detail
                </p>
                <FlagNavigation
                  index={flagIndex}
                  total={flagCount}
                  onPrevious={showPrevious}
                  onNext={showNext}
                />
              </div>
              <ScanTimeline
                scans={report.scans}
                activeFlagIndex={flagIndex}
                onSelectFlag={goToFlag}
                compact
              />
            </div>
            <FlagDetailPanel
              flag={currentFlag}
              designTier={designTier}
              onDesignTierChange={setDesignTier}
            />
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'embedded') {
    return (
      <div className={shellClass}>
        <div className="flex flex-col gap-3 border-b border-border/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-3">
            <ScoreRingGauge score={report.score} grade={report.grade} size="sm" />
            <div>
              <p className="text-sm font-semibold">{report.host}</p>
              <p className="text-[11px] text-muted-foreground">
                {report.flagCount} flags · {report.score ?? '—'}/100
              </p>
            </div>
          </div>
          <FlagNavigation
            index={flagIndex}
            total={flagCount}
            onPrevious={showPrevious}
            onNext={showNext}
          />
        </div>

        <div className="border-b border-border/30 px-4 py-3 sm:px-5">
          <ScanTimeline
            scans={report.scans}
            activeFlagIndex={flagIndex}
            onSelectFlag={goToFlag}
            compact
          />
        </div>

        <div className="grid gap-0 lg:grid-cols-2">
          <div className="border-b border-border/30 p-4 lg:border-b-0 lg:border-r lg:p-5">
            <ScreenshotPanel report={report} preferredDevice={currentFlag.preferredDevice} />
          </div>
          <div className="p-4 lg:p-5">
            <div className="mt-1">
              <FlagDetailPanel
                flag={currentFlag}
                designTier={designTier}
                onDesignTierChange={setDesignTier}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // variant === 'page'
  return (
    <div className={cn('space-y-6', className)}>
      <div className={shellClass}>
        <div className="flex flex-col gap-4 border-b border-border/30 px-4 py-4 sm:px-6 sm:py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-start gap-5">
            <ScoreRingGauge
              score={report.score}
              grade={report.grade}
              size="lg"
              label="Overall score"
            />
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-muted/60 px-2.5 py-1 text-[11px] font-medium">
                  {report.pageType ?? 'Marketing homepage'}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">{report.url}</span>
              </div>
              {report.verdict && (
                <p className="max-w-prose border-l-2 border-brand pl-3 text-base font-medium leading-snug text-balance sm:text-lg">
                  {report.verdict}
                </p>
              )}
              <RubricPills scores={report.rubricScores} />
            </div>
          </div>
          <FlagNavigation
            index={flagIndex}
            total={flagCount}
            onPrevious={showPrevious}
            onNext={showNext}
          />
        </div>

        <div className="border-b border-border/30 px-4 py-4 sm:px-6">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
            Scans
          </p>
          <ScanTimeline
            scans={report.scans}
            activeFlagIndex={flagIndex}
            onSelectFlag={goToFlag}
          />
        </div>

        <div className="grid gap-0 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="border-b border-border/30 p-4 sm:p-6 xl:border-b-0 xl:border-r">
            <ScreenshotPanel report={report} preferredDevice={currentFlag.preferredDevice} />
          </div>

          <div className="grid gap-0 lg:grid-cols-[0.85fr_1.15fr] xl:grid-cols-1">
            <div className="border-b border-border/30 bg-muted/10 p-4 sm:p-6 lg:border-b-0 lg:border-r xl:border-b xl:border-r-0">
              <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                Steps
              </p>
              <PipelineStepsList steps={report.pipelineSteps} />
            </div>

            <div className="p-4 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                  Check {flagIndex + 1} of {flagCount}
                </p>
                <span className="text-[11px] text-muted-foreground">
                  ← → to navigate
                </span>
              </div>
              <FlagDetailPanel
                flag={currentFlag}
                designTier={designTier}
                onDesignTierChange={setDesignTier}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
