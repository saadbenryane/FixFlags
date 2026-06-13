import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Body, Heading } from '@/components/ui/typography'
import { TerminalBlock } from '@/components/marketing/TerminalBlock'
import { MCP_DOCS, MCP_SECTION } from '@/lib/marketing/copy'
import { buildPageMetadata } from '@/lib/marketing/metadata'

export const metadata = buildPageMetadata('mcp', '/docs/mcp')

const CONFIG_EXAMPLES = {
  claudeCode: `# ~/.claude/mcp-servers.json
{
  "qualityos": {
    "command": "npx",
    "args": ["-y", "@qualityos/mcp"],
    "env": {
      "QOS_API_KEY": "qos_live_your_key_here"
    }
  }
}`,
  cursor: `# .cursor/mcp.json
{
  "mcpServers": {
    "qualityos": {
      "url": "https://qualityos.com/api/mcp",
      "headers": {
        "x-api-key": "qos_live_your_key_here"
      }
    }
  }
}`,
  windsurf: `# ~/.codeium/windsurf/mcp_config.json
{
  "mcpServers": {
    "qualityos": {
      "serverUrl": "https://qualityos.com/api/mcp",
      "headers": {
        "x-api-key": "qos_live_your_key_here"
      }
    }
  }
}`,
}

const TOOLS = [
  { name: 'qos_audit_url', desc: 'Start a quality audit on any URL. Returns auditId.' },
  { name: 'qos_get_audit_status', desc: 'Check if an audit is complete.' },
  { name: 'qos_get_report', desc: 'Get the full report with all 7 area grades and scores.' },
  { name: 'qos_get_area', desc: 'Get detailed findings + fix prompt for one area (Performance, SEO, Mobile, etc.)' },
  { name: 'qos_get_finding', desc: 'Get the fix prompt for a specific finding.' },
  { name: 'qos_recheck', desc: 'Run a new audit on the same URL to verify fixes.' },
  { name: 'qos_compare', desc: 'Compare two audits — see what improved, stayed the same, or regressed.' },
]

export default function McpDocsPage() {
  return (
    <Section spacing="default">
      <Container className="max-w-3xl space-y-10">
        <div className="space-y-3">
          <Heading as="h1">{MCP_DOCS.headline}</Heading>
          <Body className="text-muted-foreground">{MCP_DOCS.subhead}</Body>
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings/api-keys">Get API key</Link>
          </Button>
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

          {Object.entries(CONFIG_EXAMPLES).map(([tool, config]) => {
            const labels: Record<string, string> = {
              claudeCode: 'Claude Code',
              cursor: 'Cursor',
              windsurf: 'Windsurf',
            }
            return (
              <Card key={tool} className="overflow-hidden border-border/60">
                <CardHeader className="rounded-nested-top-md border-b bg-muted/30 pb-2">
                  <CardTitle className="text-base">{labels[tool]}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <pre className="overflow-x-auto p-4 font-mono text-xs">
                    <code>{config}</code>
                  </pre>
                </CardContent>
              </Card>
            )
          })}

          <p className="text-sm text-muted-foreground">{MCP_DOCS.lovableBoltNote}</p>
        </div>

        <div className="space-y-4">
          <Heading as="h2">Available tools</Heading>
          <div className="space-y-2">
            {TOOLS.map((t) => (
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
