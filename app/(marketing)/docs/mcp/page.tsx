import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Body, Heading } from '@/components/ui/typography'
import { TerminalBlock } from '@/components/marketing/TerminalBlock'
import { McpApiKeyLink } from '@/components/marketing/McpApiKeyLink'
import { HERO, MCP_DOCS, MCP_SECTION, SITE_URL } from '@/lib/marketing/copy'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import {
  MCP_TOOL_DEFINITIONS,
  buildMcpConfigExample,
  buildMcpTestCurl,
  getMcpEndpoint,
  MCP_LOCAL_BASE_URL,
} from '@/lib/mcp/docs-content'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Surface } from '@/components/ui/surface'
import { Callout } from '@/components/ui/callout'

export const metadata = buildPageMetadata('mcp', '/docs/mcp')

const CONFIG_EDITORS = ['cursor', 'claudeCode', 'windsurf'] as const

const MCP_SECURITY = [
  'Never commit API keys to git, add .env to .gitignore and use env vars or your editor secret store.',
  'Never share keys in screenshots, Slack, or client-side code.',
  'Keys are stored hashed on the server; we cannot recover a lost key, rotate and create a new one.',
  'Rotate immediately if a key is exposed.',
] as const

export default function McpDocsPage() {
  const productionEndpoint = getMcpEndpoint(SITE_URL)
  const localEndpoint = getMcpEndpoint(MCP_LOCAL_BASE_URL)

  return (
    <Section spacing="default">
      <Container variant="content" className="space-y-10">
        <div className="space-y-3">
          <Heading as="h1">{MCP_DOCS.headline}</Heading>
          <Body className="text-muted-foreground">{MCP_DOCS.subhead}</Body>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <McpApiKeyLink />
            <Button size="sm" className="w-full sm:w-auto" asChild>
              <Link href="/#audit">
                {HERO.primaryCta}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>

        <Surface variant="elevated" className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Heading as="h2" className="text-lg">
              Quick start
            </Heading>
            <Badge variant="secondary" className="text-xs">
              {MCP_DOCS.builderRequired}
            </Badge>
          </div>
          <ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
            {MCP_DOCS.quickStart.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <div className="space-y-3">
            <p className="text-xs font-medium">Cursor config (paste into .cursor/mcp.json)</p>
            <pre className="overflow-x-auto rounded-nested-md bg-muted/40 p-4 font-mono text-xs">
              <code>{buildMcpConfigExample('cursor', SITE_URL)}</code>
            </pre>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium">Test with curl</p>
            <TerminalBlock label="curl">{buildMcpTestCurl(SITE_URL)}</TerminalBlock>
          </div>
        </Surface>

        <div className="space-y-3">
          <Heading as="h2" className="text-xl">
            {MCP_DOCS.expectationsTitle}
          </Heading>
          <div className="grid gap-3 sm:grid-cols-2">
            {MCP_DOCS.expectations.map((item) => (
              <Card key={item.label} className="space-y-2 p-4">
                <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                <p className="text-sm font-semibold leading-heading text-foreground">{item.title}</p>
                <p className="text-sm leading-body text-muted-foreground">{item.body}</p>
              </Card>
            ))}
          </div>
        </div>

        <Callout variant="neutral" title="Security">
          <ul className="space-y-2 text-xs">
            {MCP_SECURITY.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </Callout>

        <div className="space-y-4">
          <Heading as="h2">Base URL</Heading>
          <Body className="text-sm text-muted-foreground">
            FixFlags exposes an HTTP MCP endpoint at <code>/api/mcp</code>. Pass your API key in
            the <code>x-api-key</code> header.
          </Body>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="space-y-1 p-4">
              <p className="text-xs font-medium">Production</p>
              <p className="text-xs text-muted-foreground">Use for live sites and deployed apps.</p>
              <code className="text-xs break-all">{productionEndpoint}</code>
            </Card>
            <Card className="space-y-1 p-4">
              <p className="text-xs font-medium">Local development</p>
              <p className="text-xs text-muted-foreground">
                Use when running <code>npm run dev</code> on this machine.
              </p>
              <code className="text-xs break-all">{localEndpoint}</code>
            </Card>
          </div>
        </div>

        <div className="space-y-4">
          <Heading as="h2">Configuration</Heading>
          <Body className="text-sm text-muted-foreground">{MCP_DOCS.lovableBoltNote}</Body>

          {CONFIG_EDITORS.map((tool) => (
            <Card key={tool} className="overflow-hidden border-0 shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{MCP_DOCS.configLabels[tool]}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <pre className="overflow-x-auto p-4 font-mono text-xs">
                  <code>{buildMcpConfigExample(tool, SITE_URL)}</code>
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-4">
          <Heading as="h2">Available tools</Heading>
          <div className="space-y-2">
            {MCP_TOOL_DEFINITIONS.map((t) => (
              <div key={t.name} className="flex gap-3 text-sm">
                <code className="shrink-0 font-mono text-brand">{t.name}</code>
                <span className="text-muted-foreground">{t.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <TerminalBlock label="Example ship loop">{MCP_SECTION.workflow}</TerminalBlock>
      </Container>
    </Section>
  )
}
