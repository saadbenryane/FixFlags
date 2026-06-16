import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Muted } from '@/components/ui/typography'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { LANDING_PAGE, SOCIAL_PROOF } from '@/lib/marketing/copy'

export function TestimonialsSection() {
  const { label, headline, disclaimer } = LANDING_PAGE.testimonials
  const { testimonial } = SOCIAL_PROOF

  return (
    <Section
      spacing="marketing"
      id="testimonials"
      className="scroll-mt-[var(--header-offset)] bg-muted/20"
    >
      <Container className="space-y-12 sm:space-y-14">
        <LandingSectionHeader label={label} headline={headline} />

        <Card className="mx-auto max-w-2xl border-0 p-6 shadow-card sm:p-8">
          <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground">
            {testimonial.label}
          </p>
          <blockquote className="mt-4 text-base leading-relaxed text-foreground/90">
            {testimonial.quote}
          </blockquote>
          <p className="mt-4 text-sm text-muted-foreground">
            {testimonial.author} · {testimonial.company}
          </p>
          <Link
            href="/examples"
            className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-link transition-colors hover:text-link-hover"
          >
            See example reports
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Card>

        <Muted className="text-center text-sm">{disclaimer}</Muted>
      </Container>
    </Section>
  )
}
