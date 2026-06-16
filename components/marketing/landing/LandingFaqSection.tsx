import { FaqSection } from '@/components/marketing/FaqSection'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import type { FaqItem } from '@/components/marketing/FaqSection'

interface LandingFaqSectionProps {
  items: readonly FaqItem[]
  title?: string
  sectionLabel?: string
}

export function LandingFaqSection({
  items,
  title = 'Questions before you ship',
  sectionLabel = 'FAQ',
}: LandingFaqSectionProps) {
  return (
    <Section spacing="marketing" id="faq" className="scroll-mt-[var(--header-offset)]">
      <Container className="mx-auto max-w-3xl">
        <FaqSection items={items} title={title} sectionLabel={sectionLabel} />
      </Container>
    </Section>
  )
}
