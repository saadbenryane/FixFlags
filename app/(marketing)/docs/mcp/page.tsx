import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const MCP_URL = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/mcp`

const CONFIG_EXAMPLES = {
  claudeCode: `# Run in your terminal
claude mcp add --transport http qualityos ${MCP_URL} \\
  --header "x-api-key: qos_live_your_key_here"`,
  cursor: `# .cursor/mcp.json
{
  "mcpServers": {
    "qualityos": {
      "url": "${MCP_URL}",
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
      "serverUrl": "${MCP_URL}",
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
    <div className="min-h-screen">
      <nav className="border-b px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg tracking-tight">QualityOS</Link>
        <Link href="/settings/api-keys" className="text-sm font-medium text-primary hover:underline">
          Get API key →
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-12 space-y-10">
        <div className="space-y-3">
          <h1 className="text-4xl font-bold">MCP Integration</h1>
          <p className="text-muted-foreground text-lg">
            Connect QualityOS to your AI coding tool. Run audits and get fix prompts without leaving your editor.
          </p>
        </div>

        <div className="rounded-xl bg-muted/30 border p-6 space-y-3">
          <h2 className="font-semibold">Quick start</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Create a free account and upgrade to Builder</li>
            <li>Go to Settings → API Keys and generate a key</li>
            <li>Add the config below to your editor</li>
            <li>Ask your AI agent to audit your site</li>
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
{`User: "Audit https://myapp.com and fix the Mobile issues"

Claude calls: qos_audit_url → qos_get_area("Mobile")
Claude: "Mobile score is 41/100 (grade D). Here's what I found:
  - Primary CTA is below fold on 375px screens
  - 3 buttons with tap targets under 40px
  Should I apply fixes now?"
User: "Yes"
Claude: applies fixes
Claude: calls qos_recheck
Claude: "Mobile improved from 41 → 78 (D → B). 3 issues fixed."`}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
