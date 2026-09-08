import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { RevealOnView } from '@/components/marketing/landing/RevealOnView'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LANDING_PAGE } from '@/lib/marketing/copy'

export function LandingLayersSection() {
  const copy = LANDING_PAGE.layers

  return (
    <Section spacing="marketing" tint="subtle" className="overflow-hidden">
      <Container variant="marketing" className="px-4 sm:px-6 lg:px-12">
        <RevealOnView>
          <LandingSectionHeader
            align="left"
            label={copy.label}
            headline={copy.headlineDisplay}
            accentPeriod={copy.headlineAccentPeriod}
            subhead={copy.subhead}
            size="lg"
            className="max-w-3xl"
          />
        </RevealOnView>

        <div className="mt-12 grid gap-4 lg:grid-cols-2">
          {copy.cards.map((layer) => (
            <RevealOnView key={layer.id}>
              <article className="rounded-card bg-background/80 p-5 shadow-card sm:p-6">
                <p className="font-mono text-xs font-semibold uppercase tracking-label text-brand">
                  {layer.title}
                </p>
                <h3 className="mt-3 font-display text-xl font-semibold leading-heading">
                  {layer.question}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{layer.body}</p>
              </article>
            </RevealOnView>
          ))}
        </div>
      </Container>
    </Section>
  )
}
