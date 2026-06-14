import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { BrowserFrame } from '@/components/audit/BrowserFrame'
import { ScoreCard } from '@/components/audit/ScoreCard'
import { SectionIntro } from '@/components/marketing/SectionIntro'
import { SampleStatusBadge } from '@/components/marketing/SampleStatusBadge'
import { TextLink } from '@/components/ui/text-link'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { PageGrid, PageGridCol } from '@/components/ui/page-grid'
import { Section } from '@/components/ui/section'
import { ScoringLegend } from '@/components/audit/ScoringLegend'
import { ThirdPartyAuditDisclaimer } from '@/components/marketing/ThirdPartyAuditDisclaimer'
import { PROOF_SECTION } from '@/lib/marketing/copy'
import type { SampleResult } from '@/lib/marketing/live-sample'
import { areaLabel } from '@/lib/utils'
import { gradeFromScore } from '@/lib/audit/scoring'

const OBJECTIVE_AREAS = new Set(['PERFORMANCE', 'ACCESSIBILITY', 'SEO', 'MOBILE'])

export function ProofSection({ sample }: { sample: SampleResult }) {
  const audit = sample.audit
  const desktop = audit.screenshots?.find((item) => item.device === 'DESKTOP')
  const scoreGrade = audit.score === null ? null : gradeFromScore(audit.score)

  return (
    <Section spacing="default">
      <Container className="space-y-10">
        <SectionIntro
          label={PROOF_SECTION.label}
          headline={PROOF_SECTION.headline}
          subhead={PROOF_SECTION.subhead}
        />
        <ScoringLegend compact className="mx-auto max-w-prose text-center" />

        <PageGrid align="stretch">
          <PageGridCol span="intro" className="space-y-5">
            <SampleStatusBadge
              source={sample.source}
              completedAt={sample.completedAt}
              pipelineVersion={sample.pipelineVersion}
            />
            <ScoreCard
              grade={scoreGrade}
              score={audit.score}
              label="Overall score"
              size="md"
            />
            <p className="max-w-prose text-sm leading-relaxed text-muted-foreground text-pretty">
              {audit.verdict}
            </p>
            {desktop && (
              <div className="rounded-nested-md bg-muted/25 p-2">
                <BrowserFrame
                  device="desktop"
                  url={audit.url}
                  imageUrl={desktop.url}
                  state="loaded"
                  label="Captured"
                />
              </div>
            )}
          </PageGridCol>

          <PageGridCol span="content">
            <p className="mb-4 font-mono text-[10px] uppercase tracking-label text-muted-foreground/80">
              All seven areas
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {audit.areas.map((area) => (
                <li key={area.id}>
                  <ScoreCard
                    areaName={area.name}
                    grade={area.grade}
                    score={OBJECTIVE_AREAS.has(area.name) ? area.score : null}
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
              View full sample report
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </Container>
    </Section>
  )
}
