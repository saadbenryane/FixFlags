import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { SeverityBadge } from '@/components/audit/SeverityBadge'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { RevealOnView } from '@/components/marketing/landing/RevealOnView'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LANDING_PAGE } from '@/lib/marketing/copy'
import { rubricLabel } from '@/lib/utils'

export function ReportExamplesSection() {
  const { headline, subhead, seeInSample, seeInSampleHref, cards } = LANDING_PAGE.reportExamples

  return (
    <Section
      spacing="marketing"
      id="report-examples"
      className="scroll-mt-[var(--header-offset)] bg-muted/20"
    >
      <Container className="space-y-8 sm:space-y-10">
        <RevealOnView>
          <div className="mx-auto max-w-3xl space-y-3 text-center">
            <LandingSectionHeader headline={headline} />
            <p className="text-sm leading-relaxed text-muted-foreground text-pretty sm:text-base">
              {subhead}
            </p>
          </div>
        </RevealOnView>

        <RevealOnView>
          <ul className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 sm:gap-5">
            {cards.map((card) => (
              <li
                key={card.id}
                className="flex flex-col overflow-hidden rounded-card border-0 shadow-card glass-surface"
              >
                <div className="border-b border-border/30 bg-muted/20 p-5 sm:p-6">
                  <p className="meta-label mb-2.5 text-muted-foreground">{card.topic}</p>
                  <div className="mb-2.5 flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={card.severity} />
                    <span className="meta-label text-muted-foreground">
                      {rubricLabel(card.rubric)}
                    </span>
                  </div>
                  <p className="text-sm font-medium leading-snug text-foreground text-pretty">
                    {card.problem}
                  </p>
                </div>
                <div className="flex flex-1 flex-col p-5 sm:p-6">
                  <p className="flex-1 text-sm leading-relaxed text-muted-foreground text-pretty">
                    {card.evidence}
                  </p>
                  <Link
                    href={seeInSampleHref}
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand transition-colors hover:text-brand/80"
                  >
                    {seeInSample}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </RevealOnView>
      </Container>
    </Section>
  )
}
