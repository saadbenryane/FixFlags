import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { GradeBadge } from '@/components/audit/GradeBadge'
import { SectionIntro } from '@/components/marketing/SectionIntro'
import { SampleStatusBadge } from '@/components/marketing/SampleStatusBadge'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { ThirdPartyAuditDisclaimer } from '@/components/marketing/ThirdPartyAuditDisclaimer'
import { PROOF_SECTION } from '@/lib/marketing/copy'
import type { SampleResult } from '@/lib/marketing/live-sample'

function formatAreaName(name: string) {
  return name.charAt(0) + name.slice(1).toLowerCase()
}

const OBJECTIVE_AREAS = new Set(['PERFORMANCE', 'ACCESSIBILITY', 'SEO', 'MOBILE'])

export function ProofSection({ sample }: { sample: SampleResult }) {
  const audit = sample.audit

  return (
    <Section spacing="default">
      <Container className="space-y-12">
        <SectionIntro
          label={PROOF_SECTION.label}
          headline={PROOF_SECTION.headline}
          subhead={PROOF_SECTION.subhead}
        />

        <div className="overflow-hidden rounded-card bg-card shadow-card">
          <div className="grid lg:grid-cols-[minmax(0,0.38fr)_minmax(0,0.62fr)]">
            <div className="space-y-5 border-b border-border/15 p-6 sm:p-8 lg:border-b-0 lg:border-r">
              <SampleStatusBadge
                source={sample.source}
                completedAt={sample.completedAt}
                pipelineVersion={sample.pipelineVersion}
              />
              <div className="flex items-start gap-3">
                <div className="rounded-md border border-brand/25 bg-brand/[0.06] px-4 py-3 text-center">
                  <div className="font-mono text-4xl font-bold tabular-nums text-brand leading-none">
                    {audit.score ?? '—'}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">/100</div>
                </div>
                <div className="min-w-0 pt-1">
                  <p className="font-semibold">
                    {sample.source === 'live' ? 'Live pipeline sample' : 'Sample report'}
                  </p>
                  <p className="truncate font-mono text-[10px] text-muted-foreground">
                    {new URL(audit.url).hostname}
                  </p>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
                {audit.verdict}
              </p>
            </div>

            <div className="p-6 sm:p-8">
              <p className="mb-4 font-mono text-[10px] uppercase tracking-label text-muted-foreground/80">
                All seven areas
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {audit.areas.map((area) => (
                  <li
                    key={area.id}
                    className="flex items-center justify-between gap-3 rounded-md bg-muted/30 px-3 py-2.5"
                  >
                    <span className="text-sm font-medium">{formatAreaName(area.name)}</span>
                    <div className="flex items-center gap-2">
                      {OBJECTIVE_AREAS.has(area.name) && (
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                          {area.score ?? '—'}
                        </span>
                      )}
                      <GradeBadge grade={area.grade} size="sm" areaName={area.name} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="text-center space-y-4">
          <ThirdPartyAuditDisclaimer variant="compact" className="mx-auto max-w-lg text-left" />
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
