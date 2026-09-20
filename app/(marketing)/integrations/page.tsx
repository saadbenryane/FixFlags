import Link from 'next/link'
import { ArrowRight, Check, Store } from 'lucide-react'
import { AuditInput } from '@/components/audit/AuditInput'
import { MarketingPageViewTracker } from '@/components/marketing/MarketingPageViewTracker'
import { Button } from '@/components/ui/button'
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

        <div className="mx-auto mt-16 grid max-w-5xl gap-5 lg:grid-cols-[1.08fr_.92fr]">
          <article className="rounded-card bg-foreground p-7 text-background shadow-card sm:p-9">
            <p className="text-xs font-semibold text-brand">{C.available.label}</p>
            <div className="mt-8 flex items-center gap-4">
              <span className="grid h-12 w-12 place-items-center rounded-control bg-background/10" aria-hidden="true">
                <Store className="h-6 w-6" />
              </span>
              <Heading as="h2" className="font-display text-3xl font-semibold tracking-display">{C.available.title}</Heading>
            </div>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-background/70">{C.available.body}</p>
            <ul className="mt-7 grid gap-3">
              {C.available.facts.map(fact => <li key={fact} className="flex items-center gap-3 text-sm text-background/82"><Check className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />{fact}</li>)}
            </ul>
            <Button variant="brand" className="mt-8" asChild>
              <Link href="/install">{C.available.action}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
            </Button>
          </article>

          <article className="rounded-card bg-muted/55 p-7 shadow-card sm:p-9">
            <p className="text-xs font-semibold text-brand">{C.future.label}</p>
            <Heading as="h2" className="mt-5 font-display text-3xl font-semibold tracking-display">{C.future.title}</Heading>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{C.future.body}</p>
            <div className="mt-7 divide-y divide-border/70">
              {C.future.items.map(item => <div key={item.title} className="py-5 first:pt-0 last:pb-0">
                <h3 className="font-display text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </div>)}
            </div>
          </article>
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
