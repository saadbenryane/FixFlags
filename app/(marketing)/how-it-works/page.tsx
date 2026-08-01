import Link from 'next/link'
import {
  ArrowRight,
  Bot,
  Flag,
  RefreshCcw,
  Wrench,
} from 'lucide-react'
import { AuditInput } from '@/components/audit/AuditInput'
import { AiGapHero } from '@/components/marketing/how-it-works/AiGapHero'
import { TerminalBlock } from '@/components/marketing/TerminalBlock'
import { MarketingPageViewTracker } from '@/components/marketing/MarketingPageViewTracker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Heading } from '@/components/ui/typography'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import { HOW_IT_WORKS_PAGE } from '@/lib/marketing/copy'

export const metadata = buildPageMetadata('howItWorks', '/how-it-works')

const LOOP_ICONS = [Flag, Wrench, RefreshCcw] as const

export default function HowItWorksPage() {
  const { reportPreview, reviewTypes, loop, mcp, finalCta } = HOW_IT_WORKS_PAGE

  return (
    <>
      <MarketingPageViewTracker page="/how-it-works" />
      <AiGapHero />

      <Section spacing="marketing">
        <Container variant="wide" className="grid gap-8 lg:grid-cols-[0.75fr_1fr] lg:items-start">
          <div className="space-y-4">
            <Badge variant="outline" className="w-fit">
              {reportPreview.label}
            </Badge>
            <Heading as="h2" className="max-w-xl">
              {reportPreview.title}
            </Heading>
            <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
              {reportPreview.body}
            </p>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
              {reportPreview.rubricLine}
            </p>
            <Button variant="outline" asChild>
              <Link href={reportPreview.sampleHref}>
                {reportPreview.sampleCta}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>

          <Card variant="strong" className="overflow-hidden p-0">
            <div className="border-b border-border/40 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Flag className="h-4 w-4 text-brand" aria-hidden />
                  <p className="font-mono text-xs font-semibold">{reportPreview.sampleLabel}</p>
                </div>
                <Badge variant="secondary" size="sm">
                  {reportPreview.flags.length} Flags
                </Badge>
              </div>
            </div>
            <div className="divide-y divide-border/35">
              {reportPreview.flags.map((flag) => (
                <div key={flag.finding} className="grid gap-3 p-5 sm:grid-cols-[9rem_1fr]">
                  <div className="space-y-2">
                    <Badge
                      variant={flag.severity === 'Critical' ? 'destructive' : 'secondary'}
                      size="sm"
                      className="w-fit"
                    >
                      {flag.severity}
                    </Badge>
                    <p className="text-xs font-semibold text-muted-foreground">{flag.rubric}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="font-semibold leading-snug">{flag.finding}</p>
                    <p className="text-sm leading-relaxed text-muted-foreground">{flag.evidence}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Container>
      </Section>

      <Section spacing="marketing">
        <Container variant="wide" className="space-y-8">
          <div className="mx-auto max-w-3xl space-y-3 text-center">
            <Badge variant="outline" className="mx-auto w-fit">
              {reviewTypes.label}
            </Badge>
            <Heading as="h2">{reviewTypes.title}</Heading>
            <p className="text-base leading-relaxed text-muted-foreground">{reviewTypes.body}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Card variant="strong" className="p-5 sm:p-6">
              <h3 className="text-lg font-semibold tracking-heading">
                {reviewTypes.productReview.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {reviewTypes.productReview.body}
              </p>
            </Card>
            <Card variant="strong" className="p-5 sm:p-6">
              <h3 className="text-lg font-semibold tracking-heading">
                {reviewTypes.deepReview.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {reviewTypes.deepReview.body}
              </p>
            </Card>
          </div>
          <p className="mx-auto max-w-2xl text-center text-sm leading-relaxed text-muted-foreground">
            {reviewTypes.analogyLine}
          </p>
          <div className="flex justify-center">
            <Button variant="outline" asChild>
              <Link href={reviewTypes.docsHref}>
                {reviewTypes.docsCta}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </Container>
      </Section>

      <Section spacing="marketing">
        <Container variant="wide" className="space-y-8">
          <div className="mx-auto max-w-3xl space-y-3 text-center">
            <Badge variant="outline" className="mx-auto w-fit">
              {loop.label}
            </Badge>
            <Heading as="h2">{loop.title}</Heading>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {loop.steps.map((step, index) => {
              const Icon = LOOP_ICONS[index]

              return (
                <Card key={step.title} variant="strong" className="p-5 sm:p-6">
                  <div className="mb-5 flex items-center justify-between">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-nested-md bg-muted">
                      <Icon className="h-5 w-5 text-brand" aria-hidden />
                    </span>
                    <span className="font-mono text-3xl font-bold tabular-nums text-muted-foreground/20">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold tracking-heading">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                </Card>
              )
            })}
          </div>
        </Container>
      </Section>

      <Section spacing="marketing">
        <Container variant="wide" className="grid gap-8 lg:grid-cols-[0.8fr_1fr] lg:items-center">
          <div className="space-y-4">
            <Badge variant="secondary" className="w-fit">
              {mcp.label}
            </Badge>
            <Heading as="h2" className="max-w-2xl">
              {mcp.title}
            </Heading>
            <p className="max-w-xl text-base leading-relaxed text-muted-foreground">{mcp.body}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild>
                <Link href={mcp.setupHref}>
                  {mcp.setupCta}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={mcp.plansHref}>{mcp.plansCta}</Link>
              </Button>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -left-5 top-5 hidden h-14 w-14 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-card lg:flex">
              <Bot className="h-6 w-6" aria-hidden />
            </div>
            <TerminalBlock label="Agent loop">{mcp.transcript}</TerminalBlock>
          </div>
        </Container>
      </Section>

      <Section spacing="marketing">
        <Container variant="wide">
          <Card
            variant="strong"
            className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[0.9fr_1fr] lg:items-center lg:p-10"
          >
            <div className="space-y-4">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-nested-md bg-brand text-brand-foreground">
                <Flag className="h-5 w-5" aria-hidden />
              </div>
              <Heading as="h2" className="max-w-2xl">
                {finalCta.headline}
              </Heading>
              <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
                {finalCta.body}
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button variant="brand" asChild>
                  <Link href={finalCta.primaryHref}>
                    {finalCta.primaryCta}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href={finalCta.secondaryHref}>{finalCta.secondaryCta}</Link>
                </Button>
              </div>
            </div>
            <div className="rounded-card bg-background/55 p-4 shadow-inner">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Flag className="h-4 w-4 text-brand" aria-hidden />
                {finalCta.tryLabel}
              </div>
              <AuditInput source="homepage" idSuffix="-how-it-works" />
            </div>
          </Card>
        </Container>
      </Section>
    </>
  )
}
