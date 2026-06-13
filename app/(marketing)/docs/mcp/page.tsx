import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Body, Heading } from '@/components/ui/typography'
import { TerminalBlock } from '@/components/marketing/TerminalBlock'
import { McpApiKeyLink } from '@/components/marketing/McpApiKeyLink'
import { MCP_DOCS, MCP_SECTION } from '@/lib/marketing/copy'
import { buildPageMetadata } from '@/lib/marketing/metadata'

export const metadata = buildPageMetadata('mcp', '/docs/mcp')

export default function McpDocsPage() {
  return (
    <Section spacing="default">
      <Container className="max-w-3xl space-y-10">
        <div className="space-y-3">
          <Heading as="h1">{MCP_DOCS.headline}</Heading>
          <Body className="text-muted-foreground">{MCP_DOCS.subhead}</Body>
          <McpApiKeyLink />
        </div>

        <div className="marketing-panel space-y-3 p-6">
          <div className="flex items-center gap-2">
            <Heading as="h2" className="text-lg">
              Quick start
            </Heading>
            <Badge variant="secondary" className="text-xs">
              {MCP_DOCS.builderRequired}
            </Badge>
          </div>
          <ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
            {MCP_DOCS.quickStart.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>

        <div className="space-y-4">
          <Heading as="h2">Configuration</Heading>
          <Body className="text-sm text-muted-foreground">
            QualityOS exposes an HTTP MCP endpoint at <code>/api/mcp</code>. All editors use the same
            pattern — point at the URL and pass your API key in the <code>x-api-key</code> header.
          </Body>

          {Object.entries(MCP_DOCS.configExamples).map(([tool, config]) => (
            <Card key={tool} className="overflow-hidden border-0 shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {MCP_DOCS.configLabels[tool as keyof typeof MCP_DOCS.configLabels]}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <pre className="overflow-x-auto p-4 font-mono text-xs">
                  <code>{config}</code>
                </pre>
              </CardContent>
            </Card>
          ))}

          <p className="text-sm text-muted-foreground">{MCP_DOCS.lovableBoltNote}</p>
        </div>

        <div className="space-y-4">
          <Heading as="h2">Available tools</Heading>
          <div className="space-y-2">
            {MCP_DOCS.tools.map((t) => (
              <div key={t.name} className="flex gap-3 text-sm">
                <code className="shrink-0 font-mono text-brand">{t.name}</code>
                <span className="text-muted-foreground">{t.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <TerminalBlock label="Example workflow">{MCP_SECTION.workflow}</TerminalBlock>
      </Container>
    </Section>
  )
}
