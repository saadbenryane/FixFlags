import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { GradeBadge } from '@/components/audit/GradeBadge'
import { SectionIntro } from '@/components/marketing/SectionIntro'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { PROOF_SECTION } from '@/lib/marketing/copy'
import { SAMPLE_STRIPE_AUDIT } from '@/lib/marketing/sample-audit'

function formatAreaName(name: string) {
  return name.charAt(0) + name.slice(1).toLowerCase()
}

export function ProofSection() {
  const { sample } = PROOF_SECTION

  return (
    <Section spacing="default">
      <Container className="space-y-12">
        <SectionIntro
          label={PROOF_SECTION.label}
          headline={PROOF_SECTION.headline}
          subhead={PROOF_SECTION.subhead}
        />

        <div className="overflow-hidden rounded-card border-0 bg-card shadow-card">
          <div className="grid lg:grid-cols-[minmax(0,0.38fr)_minmax(0,0.62fr)]">
            {/* Score + finding */}
            <div className="space-y-5 border-b border-border/15 p-6 sm:p-8 lg:border-b-0 lg:border-r">
              <div className="flex items-start gap-4">
                <div className="rounded-md border border-brand/25 bg-brand/[0.06] px-4 py-3 text-center">
                  <div className="font-mono text-4xl font-bold tabular-nums text-brand leading-none">
                    {sample.score}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">/100</div>
                </div>
                <div className="min-w-0 pt-1">
                  <p className="font-semibold">{sample.name}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">{sample.domain}</p>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{sample.finding}</p>
              <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground/80">
                {sample.areasFlagged} areas flagged · fix prompts included
              </p>
            </div>

            {/* Area scores grid */}
            <div className="p-6 sm:p-8">
              <p className="mb-4 font-mono text-[10px] uppercase tracking-label text-muted-foreground/80">
                All seven areas
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {SAMPLE_STRIPE_AUDIT.areas.map((area) => (
                  <li
                    key={area.id}
                    className="flex items-center justify-between gap-3 rounded-md bg-muted/30 px-3 py-2.5"
                  >
                    <span className="text-sm font-medium">{formatAreaName(area.name)}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">{area.score}</span>
                      <GradeBadge grade={area.grade} size="sm" />
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs leading-[1.45] text-muted-foreground text-pretty">
                High scores still surface actionable findings with evidence and fix prompts.
              </p>
            </div>
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
