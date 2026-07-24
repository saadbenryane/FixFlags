'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useMe } from '@/hooks/useMe'

export function VibecodingProfilePrompt() {
  const { user } = useMe()
  const router = useRouter()
  const [dismissed, setDismissed] = useState(false)

  const hasProfile = user?.vibecodingLevel || user?.preferredTools?.length
  const hasRunCheck = (user?.checks.used ?? 0) > 0
  if (hasProfile || dismissed || !hasRunCheck) return null

  return (
    <Card className="bg-brand/5 p-4 ring-2 ring-brand/20 sm:p-5">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-medium">Set up MCP to run checks from your editor</p>
          <p className="text-xs text-muted-foreground">
            Connect FixFlags to Cursor, Claude Code, Windsurf, Lovable, or Bolt so your agent finds issues and
            applies fixes without copy-pasting URLs.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" onClick={() => router.push('/dashboard/mcp-setup')}>
              Set up now
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDismissed(true)}>
              Maybe later
            </Button>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setDismissed(true)}
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  )
}
