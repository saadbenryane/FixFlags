import Link from 'next/link'
import type { Route } from 'next'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { PublicPageIntro, PublicPageActions, PublicPageNextStep } from '@/components/marketing/public-site/PublicPage'
import { PUBLIC_SITE_COPY } from '@/lib/marketing/copy/public-site'
import { buildPageMetadata } from '@/lib/marketing/metadata'

export const metadata = buildPageMetadata('useCases', '/use-cases')
const C = PUBLIC_SITE_COPY.useCasesPage

export default function UseCasesPage() {
  return <>
    <PublicPageIntro page="/use-cases" label={C.label} title={C.title} body={C.body}><PublicPageActions /></PublicPageIntro>
    <Section spacing="overview"><Container variant="marketing">
      <nav aria-label={C.label} className="mb-12 flex flex-wrap gap-x-6 gap-y-2">{C.cases.map(item => <Link href={`#${item.id}`} key={item.id} className="inline-flex min-h-11 items-center text-sm font-medium text-link underline underline-offset-4">{item.title}</Link>)}</nav>
      <div className="grid gap-x-14 gap-y-14 md:grid-cols-2">
        {C.cases.map(item => <section id={item.id} key={item.id} className="scroll-mt-28">
          <h2 className="text-balance font-display text-3xl font-semibold tracking-display">{item.title}</h2>
          <p className="mt-4 text-lg leading-7">{item.situation}</p>
          <dl className="mt-6 space-y-5 text-sm leading-7">
            <div><dt className="font-semibold">{C.checksLabel}</dt><dd className="text-muted-foreground">{item.checks}</dd></div>
            <div><dt className="font-semibold">{C.evidenceLabel}</dt><dd className="text-muted-foreground">{item.evidence}</dd></div>
            <div><dt className="font-semibold">{C.limitsLabel}</dt><dd className="text-muted-foreground">{item.limits}</dd></div>
          </dl>
          <Link href={item.href as Route} className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-link underline underline-offset-4">{item.link}</Link>
        </section>)}
      </div>
    </Container></Section>
    <PublicPageNextStep />
  </>
}
