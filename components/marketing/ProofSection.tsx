import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { ScoreDisplay } from '@/components/audit/ScoreDisplay'
import { SectionIntro } from '@/components/marketing/SectionIntro'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { PageGrid, PageGridCol } from '@/components/ui/page-grid'
import { Section } from '@/components/ui/section'
import { ScoringLegend } from '@/components/audit/ScoringLegend'
import { ThirdPartyAuditDisclaimer } from '@/components/marketing/ThirdPartyAuditDisclaimer'
import { PROOF_SECTION, OUTPUT_LABELS } from '@/lib/marketing/copy'
import { getSampleSiteDisplay } from '@/lib/marketing/display-meta'
import type { SampleResult } from '@/lib/marketing/live-sample'
import { gradeFromScore } from '@/lib/audit/scoring'

export function ProofSection({ sample }: { sample: SampleResult }) {
  const audit = sample.audit
  const scoreGrade = audit.score === null ? null : gradeFromScore(audit.score)
  const site = getSampleSiteDisplay(audit.url)

  return (
    <Section spacing="default" className="bg-muted/35">
      <Container className="space-y-10">
        <SectionIntro
          label={PROOF_SECTION.label}
          headline={PROOF_SECTION.headline}
          subhead={PROOF_SECTION.subhead}
        />
        <ScoringLegend compact className="mx-auto max-w-prose text-center" />

        <PageGrid align="stretch">
          <PageGridCol span="intro" className="space-y-5">
            <p className="font-medium">{site.displayHost}</p>
            <ScoreDisplay
              grade={scoreGrade}
              score={audit.score}
              label="Overall score"
              size="md"
            />
            <p className="max-w-prose text-sm leading-relaxed text-muted-foreground text-pretty">
              {audit.verdict}
            </p>
          </PageGridCol>

          <PageGridCol span="content">
            <p className="mb-4 font-mono text-[10px] uppercase tracking-label text-muted-foreground/80">
              Rubrics
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {audit.rubricRows.map((rubric) => (
                <li key={rubric.id}>
                  <ScoreDisplay
                    rubricName={rubric.name}
                    grade={rubric.grade}
                    score={rubric.score}
                    size="sm"
                  />
                </li>
              ))}
            </ul>
          </PageGridCol>
        </PageGrid>

        <div className="space-y-4 text-center">
          <ThirdPartyAuditDisclaimer variant="compact" className="mx-auto max-w-prose text-left" />
          <Button variant="outline" asChild>
            <Link href="/samples">
              {OUTPUT_LABELS.seeFullSample}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </Container>
    </Section>
  )
}
