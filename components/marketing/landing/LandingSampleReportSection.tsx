import { ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { TextLink } from '@/components/ui/text-link'
import { Body, Muted } from '@/components/ui/typography'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { LANDING_PAGE } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

function ScoreGauge({ score }: { score: number }) {
  const radius = 42
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference

  return (
    <div className="relative mx-auto h-32 w-32">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted/30"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
          className="text-brand"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-3xl font-medium tabular-nums">{score}</span>
      </div>
    </div>
  )
}

export function LandingSampleReportSection() {
  const { label, headline, body, cta, scores } = LANDING_PAGE.sampleReport

  return (
    <Section
      spacing="marketing"
      id="sample-report"
      className="scroll-mt-[var(--header-offset)] bg-brand/[0.06]"
    >
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-5">
            <LandingSectionHeader label={label} headline={headline} align="left" />
            <Body className="max-w-prose text-muted-foreground">{body}</Body>
            <TextLink href="/samples" className="inline-flex items-center text-sm font-medium">
              {cta}
              <ArrowRight className="h-3.5 w-3.5" />
            </TextLink>
          </div>

          <Card className="border-0 bg-card p-6 shadow-card sm:p-8">
            <div className="mb-5 flex items-center justify-between gap-4 border-b border-border/30 pb-4">
              <Muted className="font-mono text-[10px] uppercase tracking-label">FixFlags report</Muted>
              <span className="rounded-md bg-muted/50 px-2 py-1 font-mono text-[10px] uppercase tracking-label text-muted-foreground">
                Sample
              </span>
            </div>
            <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start">
              <div className="text-center sm:text-left">
                <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground">
                  Total score
                </p>
                <ScoreGauge score={scores.total} />
              </div>

              <div className="w-full flex-1 space-y-4">
                {scores.rubrics.map((rubric) => (
                  <div key={rubric.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{rubric.name}</span>
                      <span className="font-mono tabular-nums text-muted-foreground">{rubric.score}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted/50">
                      <div
                        className={cn('h-full rounded-full bg-brand/80')}
                        style={{ width: `${rubric.score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </Container>
    </Section>
  )
}
