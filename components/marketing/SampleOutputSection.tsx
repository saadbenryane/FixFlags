import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { BrowserFrame } from '@/components/audit/BrowserFrame'
import { FixPromptBlock } from '@/components/audit/FixPromptBlock'
import { ScoreCard } from '@/components/audit/ScoreCard'
import { SampleStatusBadge } from '@/components/marketing/SampleStatusBadge'
import { SectionIntro } from '@/components/marketing/SectionIntro'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { PageGrid, PageGridCol } from '@/components/ui/page-grid'
import { Section } from '@/components/ui/section'
import { TextLink } from '@/components/ui/text-link'
import { gradeFromScore } from '@/lib/audit/scoring'
import {
  getTopFixPromptFromAreas,
  rankFindingsByPriority,
} from '@/lib/audit/priority-findings'
import { OUTPUT_LABELS, PROOF_SECTION } from '@/lib/marketing/copy'
import { getSampleSiteDisplay } from '@/lib/marketing/display-meta'
import type { SampleResult } from '@/lib/marketing/live-sample'
import { areaLabel } from '@/lib/utils'

const OBJECTIVE_AREAS = new Set(['PERFORMANCE', 'ACCESSIBILITY', 'SEO', 'MOBILE'])

export function SampleOutputSection({ sample }: { sample: SampleResult }) {
  const audit = sample.audit
  const scoreGrade = audit.score === null ? null : gradeFromScore(audit.score)
  const site = getSampleSiteDisplay(audit.url)
  const fixPrompt = getTopFixPromptFromAreas(audit.areas)
  const priority = rankFindingsByPriority(audit.areas, 3)
  const desktop = audit.screenshots.find((item) => item.device === 'DESKTOP')
  const mobile = audit.screenshots.find((item) => item.device === 'MOBILE')

  return (
    <Section spacing="tight" className="bg-muted/25" id="sample-output">
      <Container className="space-y-10">
        <SectionIntro
          label={PROOF_SECTION.label}
          headline={PROOF_SECTION.headline}
          subhead={PROOF_SECTION.subhead}
        />

        <PageGrid align="stretch">
          <PageGridCol span="intro" className="space-y-5">
            <div className="space-y-2">
              <SampleStatusBadge
                source={sample.source}
                completedAt={sample.completedAt}
                isDogfood={site.isDogfood}
                marketing
              />
              {audit.verdict ? (
                <p className="max-w-prose text-sm leading-relaxed text-muted-foreground text-pretty">
                  {audit.verdict}
                </p>
              ) : null}
            </div>

            <ScoreCard
              grade={scoreGrade}
              score={audit.score}
              label="Overall score"
              size="md"
              className="h-full"
            />

            <div className="grid gap-2 sm:grid-cols-2">
              {audit.areas.map((area) => (
                <ScoreCard
                  key={area.id}
                  areaName={area.name}
                  grade={area.grade}
                  score={OBJECTIVE_AREAS.has(area.name) ? area.score : null}
                  size="sm"
                  className="h-full"
                />
              ))}
            </div>
          </PageGridCol>

          <PageGridCol span="content" className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <BrowserFrame
                device="desktop"
                url={site.browserUrl}
                imageUrl={desktop?.url}
                state={desktop ? 'loaded' : 'failed'}
                alt="Desktop screenshot"
                className="shadow-card"
              />
              <BrowserFrame
                device="mobile"
                url={site.browserUrl}
                imageUrl={mobile?.url}
                state={mobile ? 'loaded' : 'failed'}
                alt="Mobile screenshot"
                className="shadow-card"
              />
            </div>

            {fixPrompt ? (
              <div className="rounded-card bg-card p-5 shadow-card">
                <FixPromptBlock
                  prompt={fixPrompt.prompt}
                  finding={fixPrompt.finding}
                  rows={4}
                  clamp={false}
                  showNextStep
                />
              </div>
            ) : null}

            {priority.length > 0 ? (
              <ul className="divide-y divide-border/15 rounded-card border-0 bg-card shadow-card">
                {priority.map(({ areaName, areaGrade, finding }) => (
                  <li key={finding.id} className="flex items-start gap-3 px-5 py-3.5">
                    <ScoreCard
                      areaName={areaName}
                      grade={areaGrade}
                      layout="compact"
                      size="sm"
                      className="mt-0.5 shrink-0 shadow-none"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-medium">{areaLabel(areaName)}</span>
                      <p className="text-sm leading-snug text-muted-foreground text-pretty">
                        {finding.problem}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </PageGridCol>
        </PageGrid>

        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Button variant="outline" asChild>
            <Link href="/samples">
              {OUTPUT_LABELS.seeFullSample}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <TextLink href="/#audit" className="text-sm">
            {PROOF_SECTION.cta}
            <ArrowRight className="h-3.5 w-3.5" />
          </TextLink>
        </div>
      </Container>
    </Section>
  )
}
