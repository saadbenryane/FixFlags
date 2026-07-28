'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { useMe } from '@/hooks/useMe'
import { buildReportMcpCommand } from '@/lib/mcp/report-command-copy'
import { useCopyToClipboard } from '@/lib/hooks/useCopyToClipboard'

interface Props {
  auditId: string
  isPaid: boolean
}

export function McpFixNudge({ auditId, isPaid }: Props) {
  const { user } = useMe()
  const { copy } = useCopyToClipboard()
  const canUseMcp = user?.entitlements?.canUseMcp ?? false

  if (!isPaid || !canUseMcp) return null

  const command = buildReportMcpCommand(auditId)

  return (
    <Callout variant="neutral" title="Fix from your editor">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Your agent can fetch this report. Tell it to run:
        </p>
        <pre className="rounded-md bg-muted/40 p-3 font-mono text-xs leading-relaxed">
          <code>{command}</code>
        </pre>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await copy(
                `I have a FixFlags report (${auditId}). Run these MCP calls to see what needs fixing:\n\n${command}`,
                { kind: 'command', auditId }
              )
            }}
          >
            Copy prompt for your agent
          </Button>
          <Button size="sm" variant="ghost" asChild>
            <Link href="/docs/mcp">
              MCP docs
              <ArrowRight className="ml-1.5 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>
    </Callout>
  )
}
