import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-10">
      <div className="space-y-3">
        <h1 className="text-4xl font-bold">{MCP_DOCS.headline}</h1>
        <p className="text-muted-foreground text-lg">{MCP_DOCS.subhead}</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/settings/api-keys">Get API key</Link>
        </Button>
      </div>

        <div className="rounded-xl bg-muted/30 border p-6 space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">Quick start</h2>
            <Badge variant="secondary" className="text-xs">{MCP_DOCS.builderRequired}</Badge>
          </div>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            {MCP_DOCS.quickStart.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Configuration</h2>

          {Object.entries(CONFIG_EXAMPLES).map(([tool, config]) => {
            const labels: Record<string, string> = {
              claudeCode: 'Claude Code',
              cursor: 'Cursor',
              windsurf: 'Windsurf',
            }
            return (
              <Card key={tool}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{labels[tool]}</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="rounded-lg bg-muted px-4 py-3 text-xs overflow-x-auto">
                    <code>{config}</code>
                  </pre>
                </CardContent>
              </Card>
            )
          })}

          <p className="text-sm text-muted-foreground">{MCP_DOCS.lovableBoltNote}</p>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Available tools</h2>
          <div className="space-y-2">
            {TOOLS.map((t) => (
              <div key={t.name} className="flex gap-3 text-sm">
                <code className="text-primary font-mono shrink-0">{t.name}</code>
                <span className="text-muted-foreground">{t.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <Card className="bg-muted/20">
          <CardContent className="pt-6 space-y-3">
            <h3 className="font-semibold">Example workflow</h3>
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
              {MCP_SECTION.workflow}
            </pre>
          </CardContent>
        </Card>
    </div>
  )
}
