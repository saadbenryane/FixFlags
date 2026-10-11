import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { PublicPageIntro, PublicPageNextStep } from '@/components/marketing/public-site/PublicPage'
import { PublicDisclosure, PublicLink } from '@/components/marketing/public-site/PublicInteraction'
import { SampleFixPrompt } from '@/components/marketing/public-site/SampleFixPrompt'
import { PUBLIC_SITE_COPY } from '@/lib/marketing/copy/public-site'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import { getCuratedSampleAudit, UnknownCuratedObservationError } from '@/lib/marketing/curated-sample'

export const metadata = buildPageMetadata('samples', '/samples')
const C = PUBLIC_SITE_COPY.samplePage

export default async function SamplesPage({ searchParams }: {
  searchParams?: Promise<{ observation?: string | string[] }>
}) {
  const params = searchParams ? await searchParams : undefined
  if (Array.isArray(params?.observation)) notFound()
  let audit: Awaited<ReturnType<typeof getCuratedSampleAudit>>['audit']
  try { ({ audit } = await getCuratedSampleAudit(params?.observation ?? null)) }
  catch (error) {
    if (error instanceof UnknownCuratedObservationError) notFound()
    throw error
  }
  const flag = audit.flags.find(item => item.checkId === 'cta-below-fold-mobile')
  const screenshot = audit.screenshots.find(item => item.device === 'MOBILE')
  if (!flag || !screenshot || !flag.agentPrompt || !flag.verificationRule) notFound()

  return <>
    <PublicPageIntro page="/samples" label={C.label} title={C.title} body={C.body} />
    <Section spacing="tight"><Container variant="marketing">
      <article data-testid="sample-site" data-observation={audit.id} className="space-y-9">
        <div><p className="section-label">{C.demoLabel}</p><h2 className="mt-3 font-display text-3xl font-semibold tracking-display">{flag.problem}</h2></div>
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <figure className="max-w-sm">
            <Image src={screenshot.url} alt={C.imageAlt} width={screenshot.width ?? 375} height={screenshot.height ?? 812} className="h-auto w-full rounded-card" />
            <figcaption className="mt-4 text-sm leading-6 text-muted-foreground">{C.scopeBody}</figcaption>
          </figure>
          <div className="space-y-8">
            <section><h3 className="text-lg font-semibold">{C.observed}</h3><p className="mt-3 leading-7 text-muted-foreground">{flag.evidence}</p></section>
            <section><h3 className="text-lg font-semibold">{C.fix}</h3><p className="mt-3 leading-7 text-muted-foreground">{flag.fix}</p></section>
            <section className="rounded-card bg-muted/30 p-6"><h3 className="mb-4 text-lg font-semibold">{C.prompt}</h3><SampleFixPrompt prompt={flag.agentPrompt} /></section>
            <section><h3 className="text-lg font-semibold">{C.verification}</h3><p className="mt-3 font-medium leading-7">{flag.verificationRule}</p><p className="mt-3 leading-7 text-muted-foreground">{C.verificationBody}</p></section>
          </div>
        </div>
        <PublicDisclosure page="/samples" target="provenance" summary={C.provenance}>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">{C.provenanceBody}</p>
          {audit.completedAt ? <p className="mt-2 text-sm text-muted-foreground">{C.captured} <time dateTime={audit.completedAt.toISOString()}>{audit.completedAt.toISOString().slice(0, 10)}</time></p> : null}
        </PublicDisclosure>
      </article>
      <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-2"><p>{C.walkthrough}</p><PublicLink href="/request-demo" target="walkthrough" className="inline-flex min-h-11 items-center font-medium text-link underline underline-offset-4">{C.walkthroughAction}</PublicLink><Link href="/coverage" className="inline-flex min-h-11 items-center text-link underline underline-offset-4">{PUBLIC_SITE_COPY.coverage}</Link></div>
    </Container></Section>
    <PublicPageNextStep />
  </>
}
