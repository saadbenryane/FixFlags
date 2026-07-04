import Link from 'next/link'
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Code2,
  ExternalLink,
  Flag,
  Globe2,
  Radar,
  RefreshCcw,
  Route,
  ScanLine,
  TerminalSquare,
} from 'lucide-react'
import { AuditInput } from '@/components/audit/AuditInput'
import { TerminalBlock } from '@/components/marketing/TerminalBlock'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Heading } from '@/components/ui/typography'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import { HOW_IT_WORKS_PAGE } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

export const metadata = buildPageMetadata('howItWorks', '/how-it-works')

const MODE_ICONS = [Globe2, TerminalSquare] as const
const LOOP_ICONS = [ScanLine, Code2, RefreshCcw] as const

export default function HowItWorksPage() {
  return (
    <>
      <Section spacing="loose" className="overflow-hidden">
        <Container variant="wide" className="space-y-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)] lg:items-center">
            <div className="space-y-6">
              <Badge variant="secondary" className="w-fit">
                {HOW_IT_WORKS_PAGE.hero.eyebrow}
              </Badge>
              <div className="space-y-4">
                <Heading as="h1" className="max-w-3xl text-4xl sm:text-5xl lg:text-6xl">
                  {HOW_IT_WORKS_PAGE.hero.headline}
                </Heading>
                <p className="max-w-2xl text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg">
                  {HOW_IT_WORKS_PAGE.hero.subhead}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button size="lg" asChild>
                  <Link href="/#audit">
                    {HOW_IT_WORKS_PAGE.hero.primaryCta}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link href="/docs/mcp">
                    {HOW_IT_WORKS_PAGE.hero.secondaryCta}
                    <ExternalLink className="h-4 w-4" aria-hidden />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-8 rounded-[2rem] bg-brand/10 blur-3xl" aria-hidden />
              <div className="relative grid gap-3 sm:grid-cols-2">
                {HOW_IT_WORKS_PAGE.modes.map((mode, index) => {
                  const Icon = MODE_ICONS[index]

                  return (
                    <Card
                      key={mode.label}
                      variant="strong"
                      className={cn(
                        'min-h-[22rem] p-5 sm:p-6',
                        index === 1 && 'sm:translate-y-8'
                      )}
                    >
                      <div className="flex h-full flex-col">
                        <div className="mb-5 flex items-center justify-between">
                          <span className="inline-flex h-11 w-11 items-center justify-center rounded-nested-md bg-muted text-foreground">
                            <Icon className="h-5 w-5" aria-hidden />
                          </span>
                          <span className="font-mono text-xs font-semibold text-muted-foreground">
                            {mode.label}
                          </span>
                        </div>
                        <h2 className="text-xl font-semibold leading-heading tracking-heading">
                          {mode.title}
                        </h2>
                        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                          {mode.body}
                        </p>
                        <ul className="mt-5 space-y-2 text-sm">
                          {mode.bullets.map((bullet) => (
                            <li key={bullet} className="flex gap-2">
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>
                        <Button
                          variant={index === 0 ? 'ink' : 'outline'}
                          size="sm"
                          className="mt-auto"
                          asChild
                        >
                          <Link href={mode.href}>
                            {mode.cta}
                            <ArrowRight className="h-4 w-4" aria-hidden />
                          </Link>
                        </Button>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </div>
          </div>
        </Container>
      </Section>

      <Section spacing="tight">
        <Container variant="wide" className="grid gap-8 lg:grid-cols-[0.75fr_1fr] lg:items-start">
          <div className="space-y-4">
            <Badge variant="outline" className="w-fit">
              {HOW_IT_WORKS_PAGE.reportPreview.label}
            </Badge>
            <Heading as="h2" className="max-w-xl">
              {HOW_IT_WORKS_PAGE.reportPreview.title}
            </Heading>
            <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
              {HOW_IT_WORKS_PAGE.reportPreview.body}
            </p>
          </div>

          <Card variant="strong" className="overflow-hidden p-0">
            <div className="border-b border-border/40 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Radar className="h-4 w-4 text-brand" aria-hidden />
                  <p className="font-mono text-xs font-semibold">fixflags.com/report/demo</p>
                </div>
                <Badge variant="secondary" size="sm">
                  3 Flags
                </Badge>
              </div>
            </div>
            <div className="divide-y divide-border/35">
              {HOW_IT_WORKS_PAGE.reportPreview.flags.map((flag) => (
                <div key={flag.finding} className="grid gap-3 p-5 sm:grid-cols-[9rem_1fr]">
                  <div className="space-y-2">
                    <Badge
                      variant={flag.status === 'Blocked' ? 'destructive' : 'secondary'}
                      size="sm"
                      className="w-fit"
                    >
                      {flag.status}
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

      <Section spacing="default">
        <Container variant="wide" className="space-y-8">
          <div className="mx-auto max-w-3xl space-y-3 text-center">
            <Badge variant="outline" className="mx-auto w-fit">
              {HOW_IT_WORKS_PAGE.loop.label}
            </Badge>
            <Heading as="h2">{HOW_IT_WORKS_PAGE.loop.title}</Heading>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {HOW_IT_WORKS_PAGE.loop.steps.map((step, index) => {
              const Icon = LOOP_ICONS[index]

              return (
                <Card key={step.title} variant="strong" className="p-5 sm:p-6">
                  <div className="mb-5 flex items-center justify-between">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-nested-md bg-muted">
                      <Icon className="h-5 w-5" aria-hidden />
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

      <Section spacing="default">
        <Container variant="wide" className="grid gap-8 lg:grid-cols-[0.8fr_1fr] lg:items-center">
          <div className="space-y-4">
            <Badge variant="secondary" className="w-fit">
              {HOW_IT_WORKS_PAGE.mcp.label}
            </Badge>
            <Heading as="h2" className="max-w-2xl">
              {HOW_IT_WORKS_PAGE.mcp.title}
            </Heading>
            <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
              {HOW_IT_WORKS_PAGE.mcp.body}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild>
                <Link href="/docs/mcp">
                  Set up MCP
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/pricing">See plans</Link>
              </Button>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -left-5 top-5 hidden h-14 w-14 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-card lg:flex">
              <Bot className="h-6 w-6" aria-hidden />
            </div>
            <TerminalBlock label="Agent loop">{HOW_IT_WORKS_PAGE.mcp.transcript}</TerminalBlock>
          </div>
        </Container>
      </Section>

      <Section spacing="loose">
        <Container variant="wide">
          <Card variant="strong" className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[0.9fr_1fr] lg:items-center lg:p-10">
            <div className="space-y-4">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-nested-md bg-brand text-brand-foreground">
                <Route className="h-5 w-5" aria-hidden />
              </div>
              <Heading as="h2" className="max-w-2xl">
                {HOW_IT_WORKS_PAGE.finalCta.headline}
              </Heading>
              <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
                {HOW_IT_WORKS_PAGE.finalCta.body}
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild>
                  <Link href="/#audit">
                    {HOW_IT_WORKS_PAGE.finalCta.primaryCta}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/docs/mcp">{HOW_IT_WORKS_PAGE.finalCta.secondaryCta}</Link>
                </Button>
              </div>
            </div>
            <div className="rounded-card bg-background/55 p-4 shadow-inner">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Flag className="h-4 w-4 text-brand" aria-hidden />
                Try it on a live URL
              </div>
              <AuditInput source="homepage" idSuffix="-how-it-works" />
            </div>
          </Card>
        </Container>
      </Section>
    </>
  )
}
