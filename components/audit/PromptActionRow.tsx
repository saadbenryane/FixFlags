'use client'

import Link from 'next/link'
import { MousePointer2 } from 'lucide-react'
import { PromptCopyButton } from '@/components/audit/PromptCopyButton'
import { Button } from '@/components/ui/button'
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
          asChild
        >
          <Link href="/docs/mcp">
            <MousePointer2 className="h-3.5 w-3.5" aria-hidden />
            Send to Cursor
          </Link>
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
