import { ArrowRight, Download, Share2 } from 'lucide-react'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { LANDING_PAGE } from '@/lib/marketing/copy'
import type { SampleSource } from '@/lib/marketing/live-sample'
import Link from 'next/link'
import { cn } from '@/lib/utils'

type RubricScore = { name: string; score: number }

function ScoreGauge({ score }: { score: number }) {
  const radius = 42
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 80 ? 'text-emerald-500' : score >= 60 ? 'text-orange-500' : 'text-red-500'

  return (
    <div className="relative h-28 w-28">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="7" className="text-muted/30" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={offset}
          className={color}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-3xl font-bold tabular-nums">{score}</span>
        <span className="text-[10px] text-muted-foreground">/ 100</span>
      </div>
    </div>
  )
}

const RUBRIC_COLORS: Record<string, string> = {
  Message: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  Experience: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  Trust: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  Reach: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
}

const FLAG_COUNTS: Record<string, number> = {
  Message: 5,
  Experience: 7,
  Trust: 4,
  Reach: 4,
}

interface LandingSampleReportSectionProps {
  totalScore?: number | null
  rubrics?: readonly RubricScore[]
  sampleHref?: string
  source?: SampleSource
}

export function LandingSampleReportSection({
  totalScore,
  rubrics,
  sampleHref = '/samples',
  source = 'static',
}: LandingSampleReportSectionProps) {
  const { headline, body, cta, scores } = LANDING_PAGE.sampleReport
  const resolvedTotal = totalScore ?? scores.total
  const resolvedRubrics = rubrics ?? scores.rubrics

  return (
    <Section spacing="marketing" id="sample-report" className="scroll-mt-[var(--header-offset)]">
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left */}
          <div className="space-y-6">
            <LandingSectionHeader label="SAMPLE REPORT" headline={headline} align="left" />
            <p className="max-w-prose text-base leading-relaxed text-muted-foreground">{body}</p>
            <Link
              href={sampleHref}
              className="inline-flex items-center gap-2 text-sm font-semibold text-orange-500 transition-colors hover:text-orange-600"
            >
              {cta}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Right: report card mockup */}
          <div className="rounded-2xl border border-border/50 bg-card shadow-xl">
            {/* report header */}
            <div className="flex items-center justify-between border-b border-border/40 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <div>
                  <p className="text-sm font-semibold">fixflags.dev</p>
                  <p className="text-[11px] text-muted-foreground">Scanned 2 minutes ago</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted/50 transition-colors">
                  <Share2 className="h-3 w-3" />
                  Share
                </button>
                <button className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted/50 transition-colors">
                  <Download className="h-3 w-3" />
                  Export
                </button>
              </div>
            </div>

            {/* score + rubrics */}
            <div className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-start">
              <div className="flex flex-col items-center gap-1 text-center">
                <ScoreGauge score={resolvedTotal} />
                <span className="mt-1 rounded-full bg-orange-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-orange-600">
                  Needs work
                </span>
              </div>

              <div className="w-full flex-1 grid grid-cols-3 gap-3">
                {resolvedRubrics.map((rubric) => (
                  <div
                    key={rubric.name}
                    className={cn(
                      'rounded-xl border p-3 text-center',
                      RUBRIC_COLORS[rubric.name] ?? 'bg-muted/30 text-foreground border-border'
                    )}
                  >
                    <p className="font-mono text-xl font-bold tabular-nums">{rubric.score}</p>
                    <p className="mt-0.5 text-[11px] font-semibold">{rubric.name}</p>
                    <p className="text-[10px] opacity-70">
                      {FLAG_COUNTS[rubric.name] ?? 0} flags
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* flag preview bar */}
            <div className="border-t border-border/40 px-5 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">7 high-impact flags</span>
                <div className="flex gap-2">
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-foreground">
                    All
                  </span>
                  <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                    High-impact
                  </span>
                </div>
              </div>
              {source === 'static' && (
                <p className="mt-2 text-[10px] text-muted-foreground/60">Illustrative scores</p>
              )}
            </div>
          </div>
        </div>
      </Container>
    </Section>
  )
}
