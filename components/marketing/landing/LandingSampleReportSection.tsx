import { ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { TextLink } from '@/components/ui/text-link'
import { Heading, Muted } from '@/components/ui/typography'
import { LANDING_PAGE } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

function ScoreGauge({ score }: { score: number }) {
  const radius = 42
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference

  return (
    <div className="relative mx-auto h-28 w-28">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
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
  const { headline, body, cta, scores } = LANDING_PAGE.sampleReport

  return (
    <Section spacing="loose" id="sample-report" className="scroll-mt-[var(--header-offset)]">
      <Container>
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-5">
            <Heading as="h2">{headline}</Heading>
            <Muted className="max-w-prose text-base leading-relaxed">{body}</Muted>
            <TextLink href="/samples" className="inline-flex items-center text-sm font-medium">
              {cta}
              <ArrowRight className="h-3.5 w-3.5" />
            </TextLink>
          </div>

          <Card className="border-0 p-6 shadow-card sm:p-8">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
              <div className="text-center sm:text-left">
                <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground">
                  Total score
                </p>
                <ScoreGauge score={scores.total} />
              </div>

              <div className="w-full flex-1 space-y-3">
                {scores.rubrics.map((rubric) => (
                  <div key={rubric.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span>{rubric.name}</span>
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
