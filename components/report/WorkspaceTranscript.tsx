'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { Check, CheckCircle2, CircleAlert, Flag, Loader2 } from 'lucide-react'
import type { AgentMessage } from '@/lib/audit/agent-message'
import { REPORT_COPY } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

/**
 * State icon for deterministic scan messages. Conversation bubbles stay calm;
 * only scan rows show progress, Flag, or completion marks.
 */
function scanMessageIcon(message: AgentMessage): ReactNode | null {
  if (message.source !== 'scan') return null
  if (message.kind === 'flag') {
    return <Flag className="h-4 w-4 shrink-0 text-brand" aria-hidden />
  }
  if (message.kind === 'completion') {
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden />
  }
  if (message.kind === 'failure' || message.state === 'failed') {
    return <CircleAlert className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
  }
  if (message.kind === 'warning' || message.state === 'warning') {
    return <CircleAlert className="h-4 w-4 shrink-0 text-warning" aria-hidden />
  }
  if (message.state === 'active') {
    return (
      <Loader2 className="h-4 w-4 shrink-0 text-brand motion-safe:animate-spin" aria-hidden />
    )
  }
  return <Check className="h-4 w-4 shrink-0 text-success/70" aria-hidden />
}

interface WorkspaceTranscriptProps {
  messages: AgentMessage[]
  /**
   * Flag deep links resolve against a real report route. Curated emulations
   * render the same transcript without pointing at a report that is not there.
   */
  linkFlags?: boolean
}

/**
 * Agent chat bubbles. Scan and model messages sit on the left; user turns on
 * the right. The live panel and marketing emulations share this chrome.
 */
export function WorkspaceTranscript({ messages, linkFlags = true }: WorkspaceTranscriptProps) {
  return (
    <>
      {messages.map((message) => {
        const icon = scanMessageIcon(message)
        const isUser = message.role === 'user'
        const flagLink =
          linkFlags && message.flagId ? (
            <Link
              href={`?flag=${encodeURIComponent(message.flagId)}#report-flags`}
              className="mt-2 block min-h-11 py-2 text-sm font-medium text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              {REPORT_COPY.workspace.chat.viewFlag}
            </Link>
          ) : null
        const body = (
          <>
            {message.content}
            {flagLink}
          </>
        )
        return (
          <article
            key={message.id}
            className={cn('flex motion-safe:animate-soft-reveal', isUser ? 'justify-end' : 'justify-start')}
            data-source={message.source}
          >
            <div
              className={cn(
                'max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-line',
                isUser
                  ? 'rounded-br-md bg-brand text-brand-foreground'
                  : message.kind === 'failure'
                    ? 'rounded-bl-md bg-destructive/10 text-destructive'
                    : 'rounded-bl-md bg-muted text-foreground',
              )}
              data-source={message.source}
            >
              {icon ? (
                <span className="flex items-start gap-2.5">
                  <span className="mt-0.5 shrink-0">{icon}</span>
                  <span className="min-w-0 flex-1" data-source={message.source}>
                    {body}
                  </span>
                </span>
              ) : (
                body
              )}
            </div>
          </article>
        )
      })}
    </>
  )
}
