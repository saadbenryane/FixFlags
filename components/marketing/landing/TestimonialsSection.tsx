import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { TestimonialsCarousel } from '@/components/marketing/landing/TestimonialsCarousel'
import { LANDING_PAGE } from '@/lib/marketing/copy'

export function TestimonialsSection() {
  const { label, headline, subhead, disclaimer, quotes } = LANDING_PAGE.testimonials

  return (
    <Section
      spacing="marketing"
      id="testimonials"
      className="scroll-mt-[var(--header-offset)] bg-muted/20"
    >
      <Container className="space-y-8 sm:space-y-10">
        <div className="mx-auto max-w-3xl space-y-3 text-center">
          <LandingSectionHeader label={label} headline={headline} showLabel />
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{subhead}</p>
        </div>

        <TestimonialsCarousel quotes={quotes} />

        <p className="mx-auto max-w-xl text-center text-xs leading-relaxed text-muted-foreground/80 text-pretty">
          {disclaimer}
        </p>
      </Container>
    </Section>
  )
}
