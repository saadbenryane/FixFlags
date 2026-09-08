import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { RevealOnView } from '@/components/marketing/landing/RevealOnView'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LANDING_PAGE } from '@/lib/marketing/copy'

export function LandingProofSection() {
  const copy = LANDING_PAGE.proof

  return (
    <Section spacing="marketing" className="overflow-hidden bg-background">
      <Container variant="marketing" className="px-4 sm:px-6 lg:px-12">
        <RevealOnView>
          <LandingSectionHeader
            align="left"
            label={copy.label}
            headline={copy.headlineDisplay}
            accentPeriod={copy.headlineAccentPeriod}
            subhead={copy.subhead}
            size="lg"
            className="max-w-2xl"
          />
        </RevealOnView>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {copy.states.map((state) => (
            <RevealOnView key={state.id}>
              <article className="rounded-card bg-background p-5 shadow-card">
                <h3
                  className={
                    state.id === 'GREEN'
                      ? 'font-display text-xl font-semibold text-emerald-700 dark:text-emerald-300'
                      : state.id === 'RED'
                        ? 'font-display text-xl font-semibold text-destructive'
                        : 'font-display text-xl font-semibold text-muted-foreground'
                  }
                >
                  {state.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{state.body}</p>
              </article>
            </RevealOnView>
          ))}
        </div>
      </Container>
    </Section>
  )
}
