import Link from 'next/link'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { PublicPageIntro, PublicPageActions, PublicPageNextStep } from '@/components/marketing/public-site/PublicPage'
import { PublicDisclosure } from '@/components/marketing/public-site/PublicInteraction'
import { PUBLIC_SITE_COPY } from '@/lib/marketing/copy/public-site'
import { HOMEPAGE_CHECK_COVERAGE } from '@/lib/marketing/copy/check-coverage'
import { CARD_CATALOG } from '@/lib/sites/card-areas'
import { ADVERTISED_COVERAGE_REGISTRY } from '@/lib/audit/advertised-coverage'
import { buildPageMetadata } from '@/lib/marketing/metadata'

export const metadata = buildPageMetadata('coverage', '/coverage')
const C = PUBLIC_SITE_COPY.coveragePage

export default function CoveragePage() {
  return <>
    <PublicPageIntro page="/coverage" label={C.label} title={C.title} body={C.body}><PublicPageActions /></PublicPageIntro>
    <Section spacing="overview"><Container variant="marketing">
      <nav aria-label={C.title} className="mb-10 flex flex-wrap gap-x-6 gap-y-2">
        {HOMEPAGE_CHECK_COVERAGE.areas.map(area => <Link key={area.id} href={`#${area.id}`} className="inline-flex min-h-11 items-center text-sm font-medium text-link underline underline-offset-4">{area.name}</Link>)}
      </nav>
      <div className="grid gap-x-12 gap-y-14 md:grid-cols-2">
        {HOMEPAGE_CHECK_COVERAGE.areas.map(area => <section id={area.id} key={area.id} className="min-w-0 scroll-mt-28">
          <h2 className="font-display text-3xl font-semibold tracking-display">{area.name}</h2>
          <p className="mt-4 text-lg">{CARD_CATALOG[area.id].question}</p>
          <PublicDisclosure page="/coverage" target={area.id} summary={C.detailLabel} className="mt-4">
            {area.groups.map(group => <div className="mt-6" key={group.title}>
              <h3 className="font-semibold">{group.title}</h3>
              <ul className="mt-4 space-y-6">
                {group.items.map(item => {
                  const evidence = ADVERTISED_COVERAGE_REGISTRY.get(item.id)
                  if (!evidence) throw new Error(`Missing coverage contract: ${item.id}`)
                  return <li key={item.id}>
                    <p className="font-medium">{item.label}</p>
                    <dl className="mt-2 space-y-2 text-sm leading-6 text-muted-foreground">
                      <div><dt className="inline font-medium">{C.setupLabel}: </dt><dd className="inline">{C.setup[evidence.configuration]}</dd></div>
                      <div><dt className="inline font-medium">{C.extentLabel}: </dt><dd className="inline">{C.extent[evidence.extent]} {evidence.limitation}</dd></div>
                    </dl>
                  </li>
                })}
              </ul>
            </div>)}
          </PublicDisclosure>
        </section>)}
      </div>
    </Container></Section>
    <Section spacing="tight" tint="subtle"><Container variant="marketing">
      <h2 className="font-display text-3xl font-semibold tracking-display">{C.limitsTitle}</h2>
      <div className="mt-8 grid gap-8 md:grid-cols-3">{C.limits.map(limit => <div key={limit.title}><h3 className="text-lg font-semibold">{limit.title}</h3><p className="mt-3 leading-7 text-muted-foreground">{limit.body}</p></div>)}</div>
      <Link href="/docs/site-care" className="mt-6 inline-flex min-h-11 items-center text-link underline underline-offset-4">{PUBLIC_SITE_COPY.guide}</Link>
    </Container></Section>
    <PublicPageNextStep />
  </>
}
