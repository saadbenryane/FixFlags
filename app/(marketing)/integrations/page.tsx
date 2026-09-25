import Link from 'next/link'
import type { Route } from 'next'
import { ArrowRight } from 'lucide-react'
import { AuditInput } from '@/components/audit/AuditInput'
import { MarketingPageViewTracker } from '@/components/marketing/MarketingPageViewTracker'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Heading } from '@/components/ui/typography'
import { CARE_HOME, INTEGRATIONS_PAGE as C } from '@/lib/marketing/copy'
import { buildPageMetadata } from '@/lib/marketing/metadata'

export const metadata = buildPageMetadata('integrations', '/integrations')

export default function IntegrationsPage() {
  return <>
    <MarketingPageViewTracker page="/integrations" />
    <Section spacing="hero">
      <Container variant="marketing" className="px-5 sm:px-6 lg:px-12">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold text-brand">{C.hero.label}</p>
          <Heading as="h1" className="mt-4 font-display text-5xl font-semibold tracking-display sm:text-6xl">
            {C.hero.title}
          </Heading>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {C.hero.body}
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl gap-4 sm:grid-cols-2">
          {C.items.map(item => (
            <article key={item.id} id={item.id} className="flex flex-col rounded-card border border-border/70 bg-background p-6 shadow-card sm:p-8">
              <Heading as="h2" className="font-display text-3xl font-semibold tracking-display">{item.title}</Heading>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              <p className="mt-3 text-sm leading-relaxed text-foreground">{item.limit}</p>
              <Link href={item.href as Route} className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand">
                {item.action}<ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>
      </Container>
    </Section>

    <Section tint="subtle">
      <Container variant="marketing" className="px-5 py-16 sm:px-6 sm:py-20 lg:px-12">
        <div className="mx-auto max-w-2xl text-center">
          <Heading as="h2" className="font-display text-4xl font-semibold tracking-display">{C.close.title}</Heading>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">{C.close.body}</p>
          <div className="mx-auto mt-8 max-w-xl">
            <AuditInput variant="landing" idSuffix="-integrations" ctaPlacement="hero" showLandingExtras={false} submitLabel={CARE_HOME.hero.cta} urlPlaceholder={CARE_HOME.hero.placeholder} />
            <p className="mt-3 text-xs text-muted-foreground">{CARE_HOME.hero.trust}</p>
          </div>
        </div>
      </Container>
    </Section>
  </>
}
