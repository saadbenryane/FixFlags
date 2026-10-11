import Link from 'next/link'
import type { Route } from 'next'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { PublicPageIntro } from '@/components/marketing/public-site/PublicPage'
import { PUBLIC_SITE_COPY } from '@/lib/marketing/copy/public-site'
import { buildPageMetadata } from '@/lib/marketing/metadata'

export const metadata = buildPageMetadata('security', '/security')
const C = PUBLIC_SITE_COPY.securityPage

export default function SecurityPage() {
  return <>
    <PublicPageIntro page="/security" label={C.label} title={C.title} body={C.body} />
    <Section spacing="tight"><Container variant="marketing">
      <div className="grid gap-x-14 gap-y-12 md:grid-cols-2">
        {C.sections.map(section => <section key={section.title} className="max-w-xl">
          <h2 className="text-balance font-display text-2xl font-semibold tracking-heading">{section.title}</h2>
          <p className="mt-4 text-pretty leading-7 text-muted-foreground">{section.body}</p>
          <Link href={section.href as Route} className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-link underline underline-offset-4">{section.link}</Link>
        </section>)}
      </div>
      <Link href="/terms" className="mt-12 inline-flex min-h-11 items-center text-link underline underline-offset-4">{C.terms}</Link>
    </Container></Section>
  </>
}
