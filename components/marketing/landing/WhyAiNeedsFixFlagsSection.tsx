import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { RevealOnView } from '@/components/marketing/landing/RevealOnView'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LANDING_PAGE } from '@/lib/marketing/copy'

export function WhyAiNeedsFixFlagsSection() {
  const { headline, lead, body, checks } = LANDING_PAGE.whyAiNeedsFixFlags

  return (
    <Section
      spacing="marketing"
      id="why-fixflags"
      className="scroll-mt-[var(--header-offset)]"
    >
      <Container>
        <RevealOnView>
          <div className="mx-auto max-w-2xl space-y-6 text-center">
            <LandingSectionHeader headline={headline} />
            <p className="font-serif text-xl font-medium tracking-heading text-foreground text-pretty sm:text-2xl">
              {lead}
            </p>
            <p className="text-base leading-relaxed text-muted-foreground text-pretty">
              {body}
            </p>
            <p className="pt-2 text-sm font-medium leading-relaxed text-foreground/80 text-pretty">
              {checks.join(' · ')}
            </p>
          </div>
        </RevealOnView>
      </Container>
    </Section>
  )
}
