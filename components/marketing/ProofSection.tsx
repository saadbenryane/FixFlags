import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { SectionIntro } from '@/components/marketing/SectionIntro'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { PROOF_SECTION } from '@/lib/marketing/copy'
import { SAMPLE_STRIPE_AUDIT } from '@/lib/marketing/sample-audit'
import { cn } from '@/lib/utils'

const GRADE_STYLES: Record<string, string> = {
  A: 'text-grade-A bg-grade-A/10',
  B: 'text-grade-B bg-grade-B/10',
  C: 'text-grade-C bg-grade-C/10',
  D: 'text-grade-D bg-grade-D/10',
  F: 'text-grade-F bg-grade-F/10',
}

function formatAreaName(name: string) {
  return name.charAt(0) + name.slice(1).toLowerCase()
}

export function ProofSection() {
  const { sample } = PROOF_SECTION
  const flaggedAreas = SAMPLE_STRIPE_AUDIT.areas.filter((a) => a.findings.some((f) => f.severity !== 'INFO'))

  return (
    <Section spacing="default" className="bg-muted/35">
      <Container className="space-y-12">
        <SectionIntro
          label={PROOF_SECTION.label}
          headline={PROOF_SECTION.headline}
          subhead={PROOF_SECTION.subhead}
        />

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-12">
          <Card interactive className="overflow-hidden border-0 shadow-card">
            <CardContent className="space-y-0 p-0">
              <div className="flex items-center justify-between bg-muted/30 px-6 py-5">
                <div className="space-y-0.5">
                  <span className="font-semibold">{sample.name}</span>
                  <span className="block font-mono text-[10px] text-muted-foreground">{sample.domain}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-4xl font-bold tabular-nums text-brand">{sample.score}</span>
                  <span className="text-xs text-muted-foreground">/100</span>
                </div>
              </div>
              <div className="space-y-4 px-6 py-5">
                <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{sample.finding}</p>
                <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground/80">
                  {sample.areasFlagged} areas flagged · fix prompts included
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="marketing-panel overflow-hidden">
            <div className="border-b border-border/30 px-5 py-3.5">
              <span className="font-mono text-[11px] uppercase tracking-label text-muted-foreground/80">
                Area scores
              </span>
            </div>
            <div className="divide-y divide-border/30">
              {SAMPLE_STRIPE_AUDIT.areas.map((area) => (
                <div key={area.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <span className="text-sm font-medium">{formatAreaName(area.name)}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">{area.score}</span>
                    <span
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-md font-mono text-sm font-bold tabular-nums',
                        GRADE_STYLES[area.grade] ?? 'text-muted-foreground bg-muted'
                      )}
                    >
                      {area.grade}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {flaggedAreas.length > 0 ? (
              <div className="bg-muted/20 px-5 py-3">
                <span className="text-xs leading-[1.45] text-muted-foreground">
                  High scores still surface actionable findings with evidence and fix prompts.
                </span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="text-center">
          <Button variant="outline" asChild>
            <Link href="/samples">
              {PROOF_SECTION.cta}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </Container>
    </Section>
  )
}
