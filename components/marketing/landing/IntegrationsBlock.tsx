import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RevealOnView } from '@/components/marketing/landing/RevealOnView'
import { MarketingEyebrow } from '@/components/marketing/MarketingEyebrow'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LANDING_PAGE } from '@/lib/marketing/copy'

export function IntegrationsBlock() {
  const copy = LANDING_PAGE.integrationsBlock

  return (
    <Section
      spacing="marketing"
      tint="subtle"
      id="integrations"
      className="scroll-mt-[var(--header-offset)] overflow-hidden py-16 sm:py-20 lg:py-24"
    >
      <Container variant="marketing" className="px-4 sm:px-6 lg:px-12">
        <RevealOnView>
          <div className="max-w-[80rem]">
            <MarketingEyebrow className="font-semibold">{copy.label}</MarketingEyebrow>
            <h2 className="mt-4 max-w-[15ch] text-balance font-display text-4xl font-bold leading-display tracking-display text-foreground sm:text-5xl">
              {copy.headlineDisplay}
              {copy.headlineAccentPeriod ? (
                <span className="text-brand" aria-hidden>.</span>
              ) : null}
            </h2>
            <p className="mt-6 max-w-[48rem] text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
              {copy.body}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button
                asChild
                variant="brand"
                className="px-4 text-sm font-semibold"
              >
                <Link href={copy.mcpHref}>
                  {copy.mcpCta}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href={copy.cliHref}>
                  {copy.cliCta}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </Button>
            </div>

          </div>
        </RevealOnView>
      </Container>
    </Section>
  )
}
