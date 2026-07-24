'use client'

import { useState } from 'react'
import { Loader2, PlugZap } from 'lucide-react'
import { toast } from 'sonner'
import { PromptCopyButton } from '@/components/audit/PromptCopyButton'
import { Button } from '@/components/ui/button'
import { useMe } from '@/hooks/useMe'
import { createApiKey } from '@/lib/api/api-key-client'
import { buildCursorInstallLink } from '@/lib/mcp/deeplinks'
import { SITE_URL } from '@/lib/marketing/copy'
import {
  apiKeyClientForTool,
  getBuilder,
  isPromptToolKey,
  type PromptToolKey,
} from '@/lib/mcp/builders'
import { cn } from '@/lib/utils'
import type { ReportAccessState, ReportSurface } from '@/lib/analytics/events'

interface PromptActionRowProps {
  prompt: string
  copyLabel?: string
  showCursorAction?: boolean
  className?: string
  compact?: boolean
  dark?: boolean
  tool?: string
  auditId?: string
  surface?: ReportSurface
  accessState?: ReportAccessState
  itemPosition?: number
  nextStep?: string
}

export function PromptActionRow({
  prompt,
  copyLabel,
  showCursorAction = false,
  className,
  compact = false,
  dark = false,
  tool,
  auditId,
  surface,
  accessState,
  itemPosition,
  nextStep,
}: PromptActionRowProps) {
  const { user } = useMe()
  const [installing, setInstalling] = useState(false)

  const actionTool: PromptToolKey =
    tool && isPromptToolKey(tool) && tool !== 'universal' ? tool : 'cursor'
  const actionBuilder = getBuilder(actionTool)

  async function connectBuilderMcp() {
    const setupPath = `/dashboard/mcp-setup?builder=${actionBuilder.apiKeyClient ?? actionTool}`
    if (!user) {
      window.location.href = `/sign-in?next=${encodeURIComponent(setupPath)}`
      return
    }

    if (actionTool !== 'cursor') {
      window.location.href = setupPath
      return
    }

    setInstalling(true)
    try {
      const data = await createApiKey({
        name: `${actionBuilder.label} MCP`,
        client: apiKeyClientForTool(actionTool),
      })
      window.location.href = buildCursorInstallLink({ baseUrl: SITE_URL, apiKey: data.key })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Could not connect to ${actionBuilder.label}`)
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
          onClick={connectBuilderMcp}
          aria-label={`Connect ${actionBuilder.label} to FixFlags`}
        >
          {installing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <PlugZap className="h-3.5 w-3.5" aria-hidden />
          )}
          {`Connect ${actionBuilder.label}`}
        </Button>
      )}
      <PromptCopyButton
        prompt={prompt}
        label={copyLabel}
        compact={compact}
        tool={tool}
        auditId={auditId}
        surface={surface}
        accessState={accessState}
        itemPosition={itemPosition}
        nextStep={nextStep}
        className={cn(
          dark &&
            'border-terminal-border bg-terminal-foreground/5 text-terminal-foreground hover:bg-terminal-foreground/10 hover:text-terminal-foreground'
        )}
      />
    </div>
  )
}
