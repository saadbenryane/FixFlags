'use client'

import { useState } from 'react'
import { MousePointer2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { PromptCopyButton } from '@/components/audit/PromptCopyButton'
import { Button } from '@/components/ui/button'
import { useMe } from '@/hooks/useMe'
import { parseApiErrorResponse } from '@/lib/api/parse-error'
import { buildCursorInstallLink } from '@/lib/mcp/deeplinks'
import { SITE_URL } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

interface PromptActionRowProps {
  prompt: string
  copyLabel?: string
  showCursorAction?: boolean
  className?: string
  compact?: boolean
  dark?: boolean
}

export function PromptActionRow({
  prompt,
  copyLabel,
  showCursorAction = false,
  className,
  compact = false,
  dark = false,
}: PromptActionRowProps) {
  const { user } = useMe()
  const [installing, setInstalling] = useState(false)

  async function sendToCursor() {
    if (!user) {
      window.location.href = '/sign-in?next=/docs/mcp'
      return
    }

    setInstalling(true)
    try {
      const res = await fetch('/api/api-keys', { method: 'PUT' })
      if (!res.ok) throw new Error((await parseApiErrorResponse(res)).message)
      const data = await res.json()
      window.location.href = buildCursorInstallLink({ baseUrl: SITE_URL, apiKey: data.key })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not connect to Cursor')
    } finally {
      setInstalling(false)
    }
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {showCursorAction && (
        <Button
          variant={dark ? 'ghost' : 'outline'}
          size="xs"
          className={cn(
            'gap-1.5',
            dark &&
              'border border-terminal-border bg-terminal-foreground/5 text-terminal-foreground hover:bg-terminal-foreground/10 hover:text-terminal-foreground'
          )}
          disabled={installing}
          onClick={sendToCursor}
        >
          {installing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <MousePointer2 className="h-3.5 w-3.5" aria-hidden />
          )}
          Send to Cursor
        </Button>
      )}
      <PromptCopyButton
        prompt={prompt}
        label={copyLabel}
        compact={compact}
        className={cn(
          dark &&
            'border-terminal-border bg-terminal-foreground/5 text-terminal-foreground hover:bg-terminal-foreground/10 hover:text-terminal-foreground'
        )}
      />
    </div>
  )
}
