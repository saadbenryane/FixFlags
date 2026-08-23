'use client'

import { type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import { Loader2, PlugZap } from 'lucide-react'
import { PromptActionRow } from '@/components/audit/PromptActionRow'
import {
  PromptToolSelector,
  usePreferredTool,
  type PromptToolKey,
} from '@/components/audit/PromptToolSelector'
import { PromptCopyButton } from '@/components/audit/PromptCopyButton'
import { TerminalShell } from '@/components/ui/terminal-shell'
import { Button } from '@/components/ui/button'
import { OUTPUT_LABELS } from '@/lib/marketing/copy'
import { resolveToolPrompt } from '@/lib/mcp/builders'
import { useConnectBuilderMcp } from '@/lib/hooks/useConnectBuilderMcp'
import { cn } from '@/lib/utils'
import type { ReportAccessState, ReportSurface } from '@/lib/analytics/events'

interface FixPromptBlockProps {
  prompt: string
  /** Clipboard text. When set, Copy uses this instead of the displayed prompt. */
  copyPrompt?: string
  toolPrompts?: Partial<Record<PromptToolKey, string | null | undefined>>
  label?: string
  finding?: string | null
  className?: string
  rows?: number
  clamp?: boolean
  showNextStep?: boolean
  showCursorAction?: boolean
  showToolSelector?: boolean
  defaultTool?: PromptToolKey
  variant?: 'terminal' | 'compact'
  /** Use concentric inner radius when nested inside a rounded-card shell */
  nested?: boolean
  auditId?: string
  flagId?: string
  surface?: ReportSurface
  accessState?: ReportAccessState
  itemPosition?: number
  copyNextStep?: string
  /** Render the body as Markdown (lean ChatGPT/Claude-style) instead of raw terminal text. */
  render?: 'raw' | 'markdown'
}

const markdownComponents = {
  h1: ({ children }: { children?: ReactNode }) => (
    <h3 className="mt-4 mb-1.5 text-sm font-semibold tracking-heading text-foreground first:mt-0">
      {children}
    </h3>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h3 className="mt-4 mb-1.5 text-sm font-semibold tracking-heading text-foreground first:mt-0">
      {children}
    </h3>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h4 className="mt-3 mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground first:mt-0">
      {children}
    </h4>
  ),
  p: ({ children }: { children?: ReactNode }) => (
    <p className="mb-2 text-sm leading-relaxed text-foreground/90 text-pretty last:mb-0">{children}</p>
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
  li: ({ children }: { children?: ReactNode }) => <li className="text-pretty">{children}</li>,
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

const promptBodyClassName =
  'w-full border-0 bg-transparent px-3 py-3 font-mono text-2xs leading-relaxed text-terminal-foreground sm:px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-0'

function PromptBody({
  prompt,
  label,
  rows,
  clamp,
}: {
  prompt: string
  label: string
  rows: number
  clamp: boolean
}) {
  if (!clamp) {
    return (
      <pre
        aria-label={label}
        className={cn(promptBodyClassName, 'm-0 whitespace-pre-wrap break-words')}
      >
        {prompt}
      </pre>
    )
  }

  return (
    <textarea
      readOnly
      value={prompt}
      rows={rows}
      aria-label={label}
      className={cn(promptBodyClassName, 'resize-none max-h-[8.5rem] overflow-hidden')}
    />
  )
}

export function FixPromptBlock({
  prompt,
  copyPrompt,
  toolPrompts,
  label = OUTPUT_LABELS.fixPrompt,
  finding,
  className,
  rows = 4,
  clamp = true,
  showNextStep = false,
  showCursorAction = false,
  showToolSelector = false,
  defaultTool,
  variant = 'terminal',
  nested = false,
  auditId,
  flagId,
  surface,
  accessState,
  itemPosition,
  copyNextStep,
  render = 'raw',
}: FixPromptBlockProps) {
  const [preferredTool, setPreferredTool] = usePreferredTool(defaultTool)
  const { installing, connect, actionBuilder } = useConnectBuilderMcp(
    showToolSelector && preferredTool !== 'universal' ? preferredTool : 'cursor'
  )
  const resolvedPrompt = showToolSelector
    ? resolveToolPrompt(toolPrompts, preferredTool, prompt)
    : prompt
  const promptUnavailable = resolvedPrompt == null
  const displayPrompt = resolvedPrompt ?? ''
  const clipboardPrompt = (copyPrompt && copyPrompt.trim()) ? copyPrompt : displayPrompt

  const shellRadius =
    nested && variant === 'compact' ? 'rounded-[var(--radius-inner)]' : nested ? 'rounded-nested-lg' : 'rounded-card'

  const toolSelector = showToolSelector && toolPrompts ? (
    <PromptToolSelector
      toolPrompts={toolPrompts}
      selectedTool={preferredTool}
      onSelect={setPreferredTool}
    />
  ) : null

  if (render === 'markdown') {
    const mShellRadius = nested ? 'rounded-[var(--radius-inner)]' : 'rounded-card'
    return (
      <div className={cn('space-y-2', className)}>
        {toolSelector}
        <div
          className={cn(
            'overflow-hidden bg-muted/20 ring-1 ring-border/50 shadow-card',
            mShellRadius
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
                  className="gap-1.5 px-2 text-muted-foreground hover:text-foreground"
                  disabled={installing}
                  onClick={connect}
                  aria-label={`Connect ${actionBuilder.label} to FixFlags`}
                >
                  {installing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <PlugZap className="h-3.5 w-3.5" aria-hidden />
                  )}
                  <span className="hidden sm:inline">{`Connect ${actionBuilder.label}`}</span>
                </Button>
              ) : null}
              {!promptUnavailable ? (
                <PromptCopyButton
                  prompt={clipboardPrompt}
                  iconOnly
                  tool={showToolSelector ? preferredTool : undefined}
                  flagId={flagId}
                />
              ) : null}
            </div>
          </div>

          <div className="px-3 py-3 sm:px-4" aria-label="Fix prompt">
            {promptUnavailable ? (
              <p className="text-sm text-destructive" role="alert">
                No validated prompt is available for this builder. Choose another builder.
              </p>
            ) : (
              <ReactMarkdown components={markdownComponents}>{displayPrompt}</ReactMarkdown>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div className={cn('space-y-2', className)}>
        {finding ? (
          <p className="text-xs leading-snug text-muted-foreground text-pretty">{finding}</p>
        ) : null}
        {toolSelector}
        <div
          className={cn(
            'bg-terminal shadow-card',
            shellRadius,
            clamp ? 'overflow-hidden' : 'overflow-visible'
          )}
        >
          {promptUnavailable ? (
            <p className="px-4 py-4 text-xs text-terminal-muted" role="alert">
              No validated prompt is available for this builder. Choose another builder.
            </p>
          ) : (
            <PromptBody prompt={clipboardPrompt} label={label} rows={rows} clamp={clamp} />
          )}
          {!promptUnavailable ? (
            <div className="flex justify-end gap-2 border-t border-terminal-border/60 px-3 py-2">
              <PromptActionRow
                prompt={clipboardPrompt}
                showCursorAction={showCursorAction}
                compact
                tool={showToolSelector ? preferredTool : undefined}
                auditId={auditId}
                flagId={flagId}
                surface={surface}
                accessState={accessState}
                itemPosition={itemPosition}
                nextStep={copyNextStep}
              />
            </div>
          ) : null}
        </div>
        {showNextStep ? (
          <p className="text-xs text-muted-foreground">{OUTPUT_LABELS.nextStep}</p>
        ) : null}
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      {finding ? (
        <p className="text-xs leading-snug text-muted-foreground text-pretty">{finding}</p>
      ) : null}
      {toolSelector}
      <TerminalShell
        label={label}
        nested={nested}
        headerRight={
          promptUnavailable ? null : (
            <PromptActionRow
              prompt={clipboardPrompt}
              showCursorAction={showCursorAction}
              compact
              tool={showToolSelector ? preferredTool : undefined}
              auditId={auditId}
              flagId={flagId}
              surface={surface}
              accessState={accessState}
              itemPosition={itemPosition}
              nextStep={copyNextStep}
            />
          )
        }
      >
        {promptUnavailable ? (
          <p className="px-4 py-4 text-xs text-terminal-muted" role="alert">
            No validated prompt is available for this builder. Choose another builder.
          </p>
        ) : (
          <PromptBody prompt={clipboardPrompt} label={label} rows={rows} clamp={clamp} />
        )}
      </TerminalShell>
      {showNextStep ? (
        <p className="text-xs text-muted-foreground">{OUTPUT_LABELS.nextStep}</p>
      ) : null}
    </div>
  )
}
