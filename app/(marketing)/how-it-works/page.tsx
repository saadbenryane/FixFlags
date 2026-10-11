import Link from 'next/link'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { PublicPageIntro, PublicPageActions, PublicPageNextStep } from '@/components/marketing/public-site/PublicPage'
import { PUBLIC_SITE_COPY } from '@/lib/marketing/copy/public-site'
import { buildPageMetadata } from '@/lib/marketing/metadata'

export const metadata = buildPageMetadata('howItWorks', '/how-it-works')
const C = PUBLIC_SITE_COPY.howItWorks

export default function HowItWorksPage() {
  return <>
    <PublicPageIntro page="/how-it-works" label={C.label} title={C.title} body={C.body}><PublicPageActions /></PublicPageIntro>
    <Section spacing="tight"><Container variant="marketing">
      <ol className="grid gap-x-14 gap-y-10 md:grid-cols-2">
        {C.steps.map((step, index) => <li key={step.title} className="flex gap-5">
          <span aria-hidden className="pt-1 font-mono text-sm tabular-nums text-brand">{String(index + 1).padStart(2, '0')}</span>
          <div><h2 className="font-display text-2xl font-semibold tracking-heading">{step.title}</h2><p className="mt-3 max-w-xl leading-7 text-muted-foreground">{step.body}</p></div>
        </li>)}
      </ol>
    </Container></Section>
    <Section spacing="tight" tint="subtle"><Container variant="marketing">
      <h2 className="font-display text-3xl font-semibold tracking-display">{C.setupTitle}</h2>
      <p className="mt-4 max-w-3xl leading-7 text-muted-foreground">{C.setupBody}</p>
      <Link href="/coverage" className="mt-4 inline-flex min-h-11 items-center font-medium text-link underline underline-offset-4">{C.setupLink}</Link>
    </Container></Section>
    <PublicPageNextStep />
  </>
}
