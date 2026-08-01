import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Heading, Body } from '@/components/ui/typography'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import { BRAND, LEGAL_PAGE_META, TERMS_SECTIONS } from '@/lib/marketing/copy'

export const metadata = buildPageMetadata('terms', '/terms')

export default function TermsPage() {
  const sections = [
    TERMS_SECTIONS.service,
    TERMS_SECTIONS.accountsAndBilling,
    TERMS_SECTIONS.founderOffer,
    TERMS_SECTIONS.waitlist,
    TERMS_SECTIONS.creditPacks,
    TERMS_SECTIONS.refunds,
    TERMS_SECTIONS.acceptableUse,
  ]

  return (
    <Section spacing="default">
      <Container variant="content" className="prose prose-neutral dark:prose-invert space-y-6">
        <Heading as="h1">Terms of Service</Heading>
        <Body className="text-muted-foreground">Last updated: {LEGAL_PAGE_META.termsUpdated}</Body>

        <section className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          {sections.map((section) => (
            <div key={section.title} className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">{section.title}</h2>
              <p>{section.body}</p>
            </div>
          ))}

          <h2 className="text-base font-semibold text-foreground">Contact</h2>
          <p>
            Questions about these terms? Email{' '}
            <a href={`mailto:${BRAND.supportEmail}`} className="text-brand hover:underline">
              {BRAND.supportEmail}
            </a>
            .
          </p>
        </section>

        <Button variant="outline" asChild>
          <Link href="/">Back to home</Link>
        </Button>
      </Container>
    </Section>
  )
}
