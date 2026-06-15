import { ComparisonTable } from '@/components/marketing/ComparisonTable'
import { SectionIntro } from '@/components/marketing/SectionIntro'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { TextLink } from '@/components/ui/text-link'
import { DIFFERENTIATION } from '@/lib/marketing/copy'

const LIGHTHOUSE_DOCS = 'https://developer.chrome.com/docs/lighthouse'

export function DifferentiationSection() {
  return (
    <Section spacing="default" className="bg-muted/35">
      <Container className="space-y-10">
        <SectionIntro
          label={DIFFERENTIATION.label}
          headline={DIFFERENTIATION.headline}
          subhead={DIFFERENTIATION.subhead}
        />

        <ul className="mx-auto max-w-prose space-y-2 text-sm leading-relaxed text-foreground text-pretty">
          {DIFFERENTIATION.bullets.map((bullet) => (
            <li key={bullet} className="flex gap-2">
              <span className="text-brand" aria-hidden>
                ·
              </span>
              <span>{bullet}</span>
            </li>
          ))}
        </ul>

        <ComparisonTable rows={DIFFERENTIATION.comparisonRows} />

        <p className="text-center text-sm text-muted-foreground">
          <TextLink href="/faq">See FAQ</TextLink> or{' '}
          <TextLink href={LIGHTHOUSE_DOCS} target="_blank" rel="noopener noreferrer">
            Google Lighthouse docs
          </TextLink>
          .
        </p>
      </Container>
    </Section>
  )
}
