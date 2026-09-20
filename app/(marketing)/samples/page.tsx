import Link from 'next/link'
import { ArrowRight, CheckCircle2, CircleDashed, Flag, ShieldCheck } from 'lucide-react'
import { MarketingPageViewTracker } from '@/components/marketing/MarketingPageViewTracker'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Body, Heading } from '@/components/ui/typography'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import { getCuratedSampleAudit } from '@/lib/marketing/curated-sample'
import { UnknownCuratedObservationError } from '@/lib/marketing/curated-sample'
import { notFound } from 'next/navigation'

export const metadata = buildPageMetadata('samples', '/samples')

const cards = [
  { name: 'Pages', status: 'Checked', icon: CheckCircle2 },
  { name: 'Conversion', status: '1 Flag', icon: Flag },
  { name: 'Security', status: 'Checked', icon: ShieldCheck },
  { name: 'Search', status: 'Checked', icon: CheckCircle2 },
  { name: 'Performance', status: 'Checked', icon: CheckCircle2 },
  { name: 'Tracking', status: 'Not checked in this sample', icon: CircleDashed },
] as const

export default async function SamplesPage({
  searchParams,
}: {
  searchParams?: Promise<{ observation?: string | string[] }>
}) {
  const params = searchParams ? await searchParams : undefined
  if (Array.isArray(params?.observation)) notFound()
  let audit: Awaited<ReturnType<typeof getCuratedSampleAudit>>['audit']
  try {
    ;({ audit } = await getCuratedSampleAudit(params?.observation ?? null))
  } catch (error) {
    if (error instanceof UnknownCuratedObservationError) notFound()
    throw error
  }
  const sampleFlag = audit.flags[0]

  return (
    <Section spacing="marketing">
      <MarketingPageViewTracker page="/samples" />
      <Container className="space-y-8">
        <header className="mx-auto max-w-3xl text-center">
          <p className="section-label">Product sample</p>
          <h1 className="mt-3 text-balance font-display text-3xl font-semibold tracking-display sm:text-5xl">
            One Site, one evidence-backed Flag
          </h1>
          <Body className="mx-auto mt-4 max-w-2xl text-pretty text-muted-foreground">
            This sample is built from a retained FixFlags fixture. It shows the Site board and the
            evidence a customer uses to Fix, Verify, and keep watching. It is not a fabricated
            customer result.
          </Body>
        </header>

        <div data-testid="sample-site" data-observation={audit.id} className="mx-auto max-w-5xl rounded-card border border-border/60 bg-background p-4 shadow-glass-deep sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border/60 pb-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Site</p>
              <Heading as="h2" className="mt-1 text-2xl">{new URL(audit.url).hostname}</Heading>
            </div>
            <span className="rounded-full bg-warning/10 px-3 py-1 text-sm font-medium text-warning-foreground">
              1 Flag
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map(({ name, status, icon: Icon }) => (
              <Card key={name} variant="subtle">
                <CardHeader className="flex-row items-center gap-3 space-y-0 pb-2">
                  <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
                  <Heading as="h3" className="text-base">{name}</Heading>
                </CardHeader>
                <CardContent><p className="text-sm text-muted-foreground">{status}</p></CardContent>
              </Card>
            ))}
          </div>

          {sampleFlag && (
            <Card className="mt-5 border-brand/25">
              <CardHeader>
                <p className="text-xs font-medium uppercase tracking-wide text-brand">Conversion Flag</p>
                <Heading as="h3" className="mt-2 text-xl">{sampleFlag.problem}</Heading>
              </CardHeader>
              <CardContent className="grid gap-5 md:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Evidence</p>
                  <p className="mt-2 text-sm leading-6 text-foreground/85">{sampleFlag.evidence}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Proposed change</p>
                  <p className="mt-2 text-sm leading-6 text-foreground/85">{sampleFlag.fix}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Verify succeeds when</p>
                  <p className="mt-2 text-sm leading-6 text-foreground/85">
                    {sampleFlag.verificationRule ?? 'Fresh comparable evidence proves the expected behavior.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex justify-center">
          <Button asChild size="lg">
            <Link href="/new">Analyze your website <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>
      </Container>
    </Section>
  )
}
