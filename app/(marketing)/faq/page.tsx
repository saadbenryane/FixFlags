import Link from 'next/link'
import { FaqSection } from '@/components/marketing/FaqSection'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Heading, Body } from '@/components/ui/typography'
import { FAQ } from '@/lib/marketing/copy'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import { ArrowRight } from 'lucide-react'

export const metadata = buildPageMetadata('faq', '/faq')

export default function FaqPage() {
  return (
    <Section spacing="default">
      <Container className="max-w-2xl space-y-10">
        <div className="space-y-3 text-center">
          <Heading as="h1">Frequently asked questions</Heading>
          <Body className="text-muted-foreground">
            Everything you need to know about QualityOS audits, fix prompts, and plans.
          </Body>
        </div>

        <FaqSection items={FAQ} title="" />

        <div className="text-center space-y-4 pt-4">
          <p className="text-muted-foreground">Ready to see what&apos;s broken?</p>
          <Button asChild>
            <Link href="/">
              Audit my site
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </Container>
    </Section>
  )
}
