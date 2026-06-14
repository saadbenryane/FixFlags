import Link from 'next/link'
import { ExternalLink, FileText, MonitorSmartphone, BarChart3 } from 'lucide-react'
import { AuditCtaBlock } from '@/components/marketing/AuditCtaBlock'
import { FINAL_CTA } from '@/lib/marketing/copy'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Body, Heading } from '@/components/ui/typography'
import { GradeBadge } from '@/components/audit/GradeBadge'
import { AreaGrid } from '@/components/audit/AreaGrid'
import { EXAMPLE_AUDITS } from '@/lib/marketing/example-audits'
import { PIPELINE_VERSION } from '@/lib/audit/pipeline-config'
import { ThirdPartyAuditDisclaimer } from '@/components/marketing/ThirdPartyAuditDisclaimer'
import { LighthouseCallout } from '@/components/marketing/LighthouseCallout'
import { buildPageMetadata } from '@/lib/marketing/metadata'

export const metadata = buildPageMetadata('examples', '/examples')

const TAG_META: Record<string, { label: string; icon: typeof FileText; description: string }> = {
  'best-practices': {
    label: 'Best practices benchmark',
    icon: BarChart3,
    description: 'A well-optimized site — shows small, nuanced issues even "good" pages have.',
  },
  marketing: {
    label: 'Marketing site example',
    icon: MonitorSmartphone,
    description: 'A real-world marketing page — reveals CTA placement and mobile conversion gaps.',
  },
  'content-heavy': {
    label: 'Content-heavy page',
    icon: FileText,
    description: 'A deep content page — highlights metadata, reading experience, and sharing issues.',
  },
}

export default function ExamplesPage() {
  return (
    <>
      <Section spacing="default">
        <Container className="max-w-4xl space-y-8">
          <div className="space-y-3">
            <Badge variant="secondary">Example audits</Badge>
            <Heading as="h1">Example audits from recognizable sites</Heading>
            <Body className="text-muted-foreground max-w-2xl">
              Representative audits illustrating QualityOS pipeline v{PIPELINE_VERSION} output.
              Results are context-dependent — every site has unique constraints and tradeoffs. These
              are not endorsements or partnerships.
            </Body>
            <LighthouseCallout className="text-sm text-muted-foreground max-w-2xl" />
          </div>

          <div className="space-y-10">
            {EXAMPLE_AUDITS.map((audit) => {
              const tag = TAG_META[audit.tag]
              const TagIcon = tag.icon
              const topIssues = audit.areas
                .flatMap((a) => a.findings.map((f) => ({ area: a, finding: f })))
                .filter((f) => f.finding.severity === 'HIGH' || f.finding.severity === 'MEDIUM')
                .slice(0, 3)

              return (
                <Card key={audit.id} id={audit.id} className="scroll-mt-24">
                  <CardHeader className="pb-0">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <TagIcon className="h-4 w-4 text-muted-foreground" />
                          <Badge variant="secondary" className="text-[10px]">
                            {tag.label}
                          </Badge>
                        </div>
                        <Heading as="h2" className="text-xl">
                          {audit.url}
                        </Heading>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span>{audit.pageType}</span>
                          <span>·</span>
                          <span>Pipeline v{PIPELINE_VERSION}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">Score</span>
                        <GradeBadge grade={audit.grade} score={audit.score} />
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    <p className="text-sm text-muted-foreground italic text-pretty">
                      &ldquo;{audit.verdict}&rdquo;
                    </p>

                    <div className="space-y-2">
                      <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground">
                        Top issues
                      </p>
                      <ul className="space-y-1.5">
                        {topIssues.map((item) => (
                          <li
                            key={item.finding.id}
                            className="flex items-start gap-2 text-sm"
                          >
                            <span className="shrink-0 mt-0.5 h-1.5 w-1.5 rounded-full bg-brand" />
                            <span className="text-foreground/90">{item.finding.problem}</span>
                            <span className="shrink-0 font-mono text-[10px] uppercase text-muted-foreground">
                              {item.area.name}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-2">
                      <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground">
                        All areas
                      </p>
                      <AreaGrid areas={audit.areas} showScoreTypes />
                    </div>

                    <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
                      <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground">
                        Sample fix prompt
                      </p>
                      {topIssues[0] && (
                        <>
                          <p className="text-sm font-medium">{topIssues[0].finding.problem}</p>
                          {topIssues[0].finding.agentPrompt && (
                            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">
                              {topIssues[0].finding.agentPrompt}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <ThirdPartyAuditDisclaimer />

          <AuditCtaBlock headline={FINAL_CTA.headline} trustLine={FINAL_CTA.trustLine} />

          <div className="flex flex-wrap gap-3 pt-4">
            <Button variant="outline" asChild>
              <Link href="/samples">
                View live sample
                <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </Container>
      </Section>
    </>
  )
}
