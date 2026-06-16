import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Heading, Body } from '@/components/ui/typography'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import { BRAND } from '@/lib/marketing/copy'

export const metadata = buildPageMetadata('privacy', '/privacy')

export default function PrivacyPage() {
  return (
    <Section spacing="default">
      <Container variant="content" className="prose prose-neutral dark:prose-invert space-y-6">
        <Heading as="h1">Privacy Policy</Heading>
        <Body className="text-muted-foreground">Last updated: June 2026</Body>

        <section className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <h2 className="text-base font-semibold text-foreground">What we collect</h2>
          <p>
            When you create an account, we store your email and name. When you run a check, we store
            the URL you submit, screenshots, automated check results, and AI-generated Flags.
          </p>

          <h2 className="text-base font-semibold text-foreground">How we use it</h2>
          <p>
            We use this data to generate reports, enforce plan limits, and improve the product. We do
            not sell your personal data.
          </p>

          <h2 className="text-base font-semibold text-foreground">Third parties</h2>
          <p>
            We use service providers for hosting, payments (Stripe), email (Resend), screenshot storage
            (Cloudflare R2), and AI analysis (OpenAI or Anthropic). These providers process data on our
            behalf under their own terms.
          </p>

          <h2 className="text-base font-semibold text-foreground">Contact</h2>
          <p>
            Questions about privacy? Email us at{' '}
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
