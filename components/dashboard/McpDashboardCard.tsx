'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Settings,
  ExternalLink,
  Cpu,
  Copy,
  Check,
  BarChart3,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useMe } from '@/hooks/useMe'
import { getMcpEndpoint } from '@/lib/mcp/docs-content'
import { SITE_URL } from '@/lib/marketing/copy'

interface Props {
  mcpAudits?: number
  webAudits?: number
}

export function McpDashboardCard({ mcpAudits = 0, webAudits = 0 }: Props) {
  const { user } = useMe()
  const [copied, setCopied] = useState(false)
  const canUseMcp = user?.entitlements?.canUseMcp ?? false

  const primaryTool = user?.preferredTools?.[0]
  const configLines = primaryTool
    ? `"mcpServers": { "fixflags": { "url": "${getMcpEndpoint(SITE_URL)}", "headers": { "x-api-key": "ff_live_..." } } }`
    : null

  if (!canUseMcp) {
    return (
      <Card className="ring-2 ring-brand/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Cpu className="h-4 w-4 text-brand" />
            MCP
            <Badge variant="secondary" size="sm">Pro</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Run checks from your editor with MCP.
          </p>
          <Button size="sm" asChild>
            <Link href="/pricing">Upgrade to Pro</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Cpu className="h-4 w-4 text-brand" />
          MCP
          <Badge variant="outline" size="sm" className="text-success border-success/30 bg-success/5">
            Active
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Your editor can now check sites via MCP.
        </p>

        {(mcpAudits > 0 || webAudits > 0) && (
          <div className="flex gap-4 text-xs">
            <div>
              <span className="font-medium text-foreground tabular-nums">{mcpAudits}</span>{' '}
              <span className="text-muted-foreground">audits via MCP</span>
            </div>
            <div>
              <span className="font-medium text-foreground tabular-nums">{webAudits}</span>{' '}
              <span className="text-muted-foreground">audits via web</span>
            </div>
          </div>
        )}

        {configLines && (
          <div className="space-y-1">
            <p className="text-3xs font-medium text-muted-foreground uppercase tracking-wider">
              Quick config
            </p>
            <div className="relative">
              <pre className="overflow-x-auto rounded-md bg-muted/40 p-2 font-mono text-3xs leading-relaxed">
                <code>{configLines}</code>
              </pre>
              <Button
                size="icon"
                variant="ghost"
                className="absolute right-1 top-1 h-6 w-6"
                onClick={async () => {
                  await navigator.clipboard.writeText(configLines)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
                aria-label="Copy config"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/mcp-analytics">
              <BarChart3 className="mr-1.5 h-3 w-3" />
              Analytics
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings/api-keys">
              <Settings className="mr-1.5 h-3 w-3" />
              Manage Keys
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/docs/mcp">
              <ExternalLink className="mr-1.5 h-3 w-3" />
              Docs
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
