import Link from 'next/link'
import { ArrowRight, KeyRound } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { buildMcpConfigExample } from '@/lib/mcp/docs-content'
import type { EditorIntegrationKey } from '@/lib/integrations/editor-catalog'

const EDITORS: Array<{ key: EditorIntegrationKey; label: string }> = [
  { key: 'codex', label: 'Codex' },
  { key: 'claudeCode', label: 'Claude Code' },
  { key: 'cursor', label: 'Cursor' },
  { key: 'windsurf', label: 'Windsurf' },
]

export default function McpSetupPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-7 px-5 py-8 sm:px-8">
      <PageHeader
        title="Connect your coding agent"
        description="Your agent can request a check. FixFlags independently runs the owned Site Outcome and returns Clear, a Flag, or Couldn't verify."
      >
        <Button asChild><Link href="/settings/api-keys"><KeyRound className="mr-2 h-4 w-4" /> Manage keys</Link></Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>The verification loop</CardTitle>
          <CardDescription>The requesting agent supplies context, never the result.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-4">
            <li><strong className="block text-foreground">1. Discover</strong>List owned Sites and Outcomes.</li>
            <li><strong className="block text-foreground">2. Verify</strong>Start an independent run.</li>
            <li><strong className="block text-foreground">3. Poll</strong>Read Clear or a Flag with evidence.</li>
            <li><strong className="block text-foreground">4. Re-verify</strong>After the fix, prove recovery.</li>
          </ol>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {EDITORS.map((editor) => (
          <Card key={editor.key}>
            <CardHeader>
              <CardTitle className="text-base">{editor.label}</CardTitle>
              <CardDescription>Create a developer key, then add this configuration.</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="max-h-72 overflow-auto rounded-[var(--radius-control)] bg-foreground p-4 text-xs text-background"><code>{buildMcpConfigExample(editor.key)}</code></pre>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        Replace the placeholder with the one-time key. For Codex, set <code>FIXFLAGS_API_KEY</code> in your environment instead. Keep keys out of committed project files, and revoke a key if it is exposed.
      </p>

      <Button asChild variant="outline" className="min-h-11"><Link href="/docs/mcp">Read the MCP guide <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
    </div>
  )
}
