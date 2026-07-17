import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { TestimonialsCarousel } from '@/components/marketing/landing/TestimonialsCarousel'
import { LANDING_PAGE } from '@/lib/marketing/copy'

export function TestimonialsSection() {
  const { headline, subhead, disclaimer, quotes } = LANDING_PAGE.testimonials

  return (
    <Section
      spacing="marketing"
      id="testimonials"
      className="scroll-mt-[var(--header-offset)] bg-muted/20"
    >
      <Container className="space-y-8 sm:space-y-10">
        <div className="mx-auto max-w-3xl space-y-3 text-center">
          <LandingSectionHeader headline={headline} />
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{subhead}</p>
          <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
            {disclaimer}
          </p>
        </div>

        <TestimonialsCarousel quotes={quotes} />
      </Container>
    </Section>
  )
}
