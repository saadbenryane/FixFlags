'use client'

import { useState } from 'react'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { PromptActionRow } from '@/components/audit/PromptActionRow'
import { REVIEW_PREVIEW } from '@/lib/marketing/review-preview'
import { cn } from '@/lib/utils'

const partnerLogos = [
  { name: 'Cursor' },
  { name: 'Codex' },
  { name: 'Lovable' },
  { name: 'Bolt' },
]

function CircleDot({ state }: { state: string }) {
  if (state === 'done') {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
        <Check className="h-3 w-3" />
      </span>
    )
  }

  if (state === 'active') {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-500/15">
        <span className="h-2 w-2 rounded-full bg-gradient-to-r from-violet-500 to-brand" />
      </span>
    )
  }

  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted">
      <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
    </span>
  )
}

function ScoreCard({ score }: { score?: number | null }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card p-3 shadow-sm">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
        {REVIEW_PREVIEW.scoreLabel}
      </p>
      {score == null ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-muted-foreground">
            {REVIEW_PREVIEW.pendingScoreLabel}
          </p>
          <div className="h-1.5 rounded-full bg-muted/60" />
        </div>
      ) : (
        <>
          <div className="flex items-end gap-2">
            <span className="font-mono text-3xl font-bold tabular-nums">{score}</span>
            <span className="mb-1 text-xs text-muted-foreground">/ 100</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-muted/50">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-brand"
              style={{ width: `${score}%` }}
            />
          </div>
        </>
      )}
    </div>
  )
}

function ProductPagePreview() {
  return (
    <div className="border-b border-border/30 p-4 sm:p-5 lg:border-b-0 lg:border-r">
      <div className="mb-4 flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-1.5">
        <span className="h-2 w-2 rounded-full bg-muted-foreground/30" aria-hidden />
        <span className="font-mono text-[10px] text-muted-foreground">{REVIEW_PREVIEW.demoHost}</span>
      </div>

      <div className="space-y-3 py-2 sm:py-4">
        <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">
          Hero section
        </p>
        <h3 className="text-lg font-bold leading-tight">
          Build something{' '}
          <span className="bg-gradient-to-r from-violet-500 to-brand bg-clip-text text-transparent">
            amazing
          </span>{' '}
          with AI
        </h3>
        <p className="text-xs text-muted-foreground">
          The all-in-one platform for next-gen teams.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <button className="pointer-events-none rounded-md bg-gradient-to-r from-violet-600 to-brand px-3 py-1.5 text-xs font-medium text-white shadow-sm">
            Get started
          </button>
          <button className="pointer-events-none rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground">
            Book a demo
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <div className="flex -space-x-1">
            {['bg-brand', 'bg-violet-400', 'bg-success'].map((color, index) => (
              <span key={index} className={cn('h-5 w-5 rounded-full border-2 border-card', color)} />
            ))}
          </div>
          <div className="flex gap-0.5" aria-label="Five star rating">
            {[...Array(5)].map((_, index) => (
              <span key={index} className="h-1.5 w-1.5 rounded-full bg-warning" />
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground">12,000+ builders</span>
        </div>
      </div>

      <div className="mt-4 border-t border-border/30 pt-4">
        <div className="flex flex-wrap items-center gap-3">
          {partnerLogos.map((logo) => (
            <span key={logo.name} className="font-sans text-[10px] font-bold text-foreground">
              {logo.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function ProgressPreview() {
  return (
    <div className="space-y-5 border-b border-border/30 bg-muted/20 p-4 sm:p-5 lg:border-b-0 lg:border-r">
      <ScoreCard score={REVIEW_PREVIEW.score} />
      <div>
        <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
          {REVIEW_PREVIEW.progressLabel}
        </p>
        <ol className="space-y-4">
          {REVIEW_PREVIEW.steps.map((step) => (
            <li key={step.label} className="flex items-center gap-3">
              <CircleDot state={step.state} />
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
                    <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-brand-foreground">
                      {step.detail}
                    </span>
                  ) : (
                    <span
                      className={cn(
                        'text-[11px]',
                        step.state === 'done'
                          ? 'text-muted-foreground'
                          : 'text-muted-foreground/40'
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
      </div>
    </div>
  )
}

export function HeroProductPreview({ className }: { className?: string }) {
  const [flagIndex, setFlagIndex] = useState(0)
  const currentFlag = REVIEW_PREVIEW.flags[flagIndex]
  const flagCount = REVIEW_PREVIEW.flags.length

  function showPreviousFlag() {
    setFlagIndex((index) => (index - 1 + flagCount) % flagCount)
  }

  function showNextFlag() {
    setFlagIndex((index) => (index + 1) % flagCount)
  }

  return (
    <div className={cn('relative mx-auto w-full max-w-5xl', className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-4 -z-10 rounded-3xl bg-[radial-gradient(ellipse_80%_60%_at_50%_60%,rgb(139_92_246/0.18),transparent_68%)]"
      />

      <div className="overflow-hidden rounded-2xl border border-border/40 bg-card/95 shadow-2xl backdrop-blur-sm">
        <div className="flex items-center gap-2 border-b border-border/30 px-4 py-3">
          <div className="flex gap-1.5" aria-hidden>
            <span className="h-3 w-3 rounded-full bg-muted-foreground/20" />
            <span className="h-3 w-3 rounded-full bg-muted-foreground/20" />
            <span className="h-3 w-3 rounded-full bg-muted-foreground/20" />
          </div>
          <div className="mx-auto flex items-center gap-2 rounded-md bg-muted/50 px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-success" aria-hidden />
            <span className="font-mono text-[11px] text-muted-foreground">
              {REVIEW_PREVIEW.reviewedHost}
            </span>
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[1fr_0.82fr_1.14fr]">
          <ProductPagePreview />
          <ProgressPreview />

          <div className="p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                Flag detail
              </p>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {flagIndex + 1} / {flagCount}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={showPreviousFlag}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:border-violet-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                    aria-label="Show previous flag"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={showNextFlag}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:border-violet-300 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                    aria-label="Show next flag"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div key={currentFlag.title} className="space-y-3 animate-soft-reveal" aria-live="polite">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-brand/15 px-2.5 py-0.5 text-[11px] font-semibold text-brand">
                  {currentFlag.severity}
                </span>
                <span className="rounded-full bg-gradient-to-r from-violet-600 to-brand px-2.5 py-0.5 text-[11px] font-bold uppercase text-white">
                  {currentFlag.rubric}
                </span>
              </div>

              <p className="text-base font-semibold leading-snug">{currentFlag.title}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {currentFlag.description}
              </p>

              <div className="space-y-1">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                  Evidence
                </p>
                <p className="rounded-lg bg-muted/50 px-3 py-2 font-mono text-[11px] text-muted-foreground">
                  {currentFlag.evidence}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium">
                  Impact: {currentFlag.impact}
                </span>
                {currentFlag.affects.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="space-y-1.5">
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                  Fix prompt
                </p>
                <p className="rounded-lg border border-brand/20 bg-brand/5 p-3 text-sm leading-relaxed text-foreground/80">
                  {currentFlag.fix}
                </p>
              </div>

              <PromptActionRow prompt={currentFlag.fix} showCursorAction className="pt-1" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
