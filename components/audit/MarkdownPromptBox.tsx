'use client'

import { useState, type ReactNode } from 'react'
import { Loader2, PlugZap } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { toast } from 'sonner'
import { PromptCopyButton } from '@/components/audit/PromptCopyButton'
import {
  PromptToolSelector,
  resolveToolPrompt,
  usePreferredTool,
  type PromptToolKey,
} from '@/components/audit/PromptToolSelector'
import { Button } from '@/components/ui/button'
import { useMe } from '@/hooks/useMe'
import { parseApiErrorResponse } from '@/lib/api/parse-error'
import { FIX_ACTION_COPY } from '@/lib/audit/fix-action-copy'
import { buildCursorInstallLink } from '@/lib/mcp/deeplinks'
import { SITE_URL } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

interface MarkdownPromptBoxProps {
  prompt: string
  toolPrompts?: Partial<Record<PromptToolKey, string | null | undefined>>
  showToolSelector?: boolean
  showCursorAction?: boolean
  className?: string
  nested?: boolean
}

const markdownComponents = {
  h1: ({ children }: { children?: ReactNode }) => (
    <h3 className="mt-4 mb-1.5 text-sm font-semibold tracking-tight text-foreground first:mt-0">
      {children}
    </h3>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h3 className="mt-4 mb-1.5 text-sm font-semibold tracking-tight text-foreground first:mt-0">
      {children}
    </h3>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h4 className="mt-3 mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground first:mt-0">
      {children}
    </h4>
  ),
  p: ({ children }: { children?: ReactNode }) => (
    <p className="mb-2 text-sm leading-relaxed text-foreground/90 text-pretty last:mb-0">
      {children}
    </p>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="mb-2 list-disc space-y-1 pl-4 text-sm leading-relaxed text-foreground/90 last:mb-0">
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="mb-2 list-decimal space-y-1 pl-4 text-sm leading-relaxed text-foreground/90 last:mb-0">
      {children}
    </ol>
  ),
  li: ({ children }: { children?: ReactNode }) => (
    <li className="text-pretty">{children}</li>
  ),
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  code: ({ children }: { children?: ReactNode }) => (
    <code className="rounded-sm bg-muted/60 px-1 py-0.5 font-mono text-2xs text-foreground">
      {children}
    </code>
  ),
  pre: ({ children }: { children?: ReactNode }) => (
    <pre className="mb-2 overflow-x-auto rounded-md bg-muted/40 p-3 font-mono text-2xs leading-relaxed text-foreground last:mb-0">
      {children}
    </pre>
  ),
}

/**
 * Lean ChatGPT/Claude-style prompt box: "Markdown" label + copy on the chrome bar,
 * rendered Markdown body. Clipboard gets the raw source string.
 */
export function MarkdownPromptBox({
  prompt,
  toolPrompts,
  showToolSelector = false,
  showCursorAction = false,
  className,
  nested = false,
}: MarkdownPromptBoxProps) {
  const [preferredTool, setPreferredTool] = usePreferredTool()
  const { user } = useMe()
  const [installing, setInstalling] = useState(false)

  const resolvedPrompt = showToolSelector
    ? resolveToolPrompt(toolPrompts, preferredTool, prompt)
    : prompt

  async function connectCursorMcp() {
    if (!user) {
      window.location.href = FIX_ACTION_COPY.cursorMcpAuthRedirect
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

  const shellRadius = nested ? 'rounded-[var(--radius-inner)]' : 'rounded-card'

  return (
    <div className={cn('space-y-2', className)}>
      {showToolSelector && toolPrompts ? (
        <PromptToolSelector
          toolPrompts={toolPrompts}
          selectedTool={preferredTool}
          onSelect={setPreferredTool}
        />
      ) : null}

      <div
        className={cn(
          'overflow-hidden bg-muted/20 ring-1 ring-border/50 shadow-card',
          shellRadius
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border/40 px-3 py-1.5">
          <span className="meta-label text-muted-foreground">Markdown</span>
          <div className="flex items-center gap-1">
            {showCursorAction ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="h-7 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
                disabled={installing}
                onClick={connectCursorMcp}
                aria-label={FIX_ACTION_COPY.cursorMcpAriaLabel}
              >
                {installing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <PlugZap className="h-3.5 w-3.5" aria-hidden />
                )}
                <span className="hidden sm:inline">{FIX_ACTION_COPY.cursorMcpLabel}</span>
              </Button>
            ) : null}
            <PromptCopyButton
              prompt={resolvedPrompt}
              iconOnly
              tool={showToolSelector ? preferredTool : undefined}
            />
          </div>
        </div>

        <div className="px-3 py-3 sm:px-4" aria-label="Fix prompt">
          <ReactMarkdown components={markdownComponents}>{resolvedPrompt}</ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
