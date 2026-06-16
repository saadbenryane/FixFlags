import { ArrowRight, Check, X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { LANDING_PAGE } from '@/lib/marketing/copy'

function ImpactCard({
  label,
  items,
  score,
  positive,
}: {
  label: string
  items: readonly string[]
  score: number
  positive: boolean
}) {
  return (
    <Card className="flex h-full flex-col border-0 bg-terminal p-5 text-terminal-foreground shadow-card sm:p-6">
      <p className="font-mono text-[11px] uppercase tracking-label text-terminal-muted">{label}</p>
      <ul className="mt-4 space-y-2.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm">
            <span
              className={positive ? 'mt-0.5 text-success' : 'mt-0.5 text-destructive'}
              aria-hidden
            >
              {positive ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
            </span>
            <span className="text-terminal-foreground/90">{item}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-6">
        <p className="font-mono text-[10px] uppercase tracking-label text-terminal-muted">
          Performance
        </p>
        <p className="mt-1 font-mono text-4xl font-medium tabular-nums">{score}</p>
      </div>
    </Card>
  )
}

export function RealImpactSection() {
  const { label, headline, before, after } = LANDING_PAGE.realImpact

  return (
    <Section spacing="marketing" id="real-impact" className="scroll-mt-[var(--header-offset)]">
      <Container className="space-y-12 sm:space-y-14">
        <LandingSectionHeader label={label} headline={headline} />

        <div className="grid items-stretch gap-6 lg:grid-cols-[1fr_auto_1fr] lg:gap-8">
          <ImpactCard
            label={before.label}
            items={before.items}
            score={before.score}
            positive={false}
          />
          <div className="flex items-center justify-center">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand lg:h-12 lg:w-12">
              <ArrowRight className="h-5 w-5 rotate-90 lg:rotate-0" aria-hidden />
            </span>
          </div>
          <ImpactCard label={after.label} items={after.items} score={after.score} positive />
        </div>
      </Container>
    </Section>
  )
}
