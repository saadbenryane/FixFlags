'use client'

import { useLayoutEffect, useRef } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { ArrowUp, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChatComposer } from '@/components/ui/chat-composer'
import { MessageBubble } from '@/components/support/MessageBubble'
import { SiteActionFeedback } from './SiteActionFeedback'
import type { SiteAgentConversation } from '@/hooks/useSiteAgentConversation'
import { SITE_AGENT_COPY as C } from '@/lib/marketing/copy/site-agent'
import { siteDetailContextHref } from '@/lib/sites/workspace-location'
import { useSiteWorkspaceLocation } from './SiteWorkspaceLocation'
import { useTranscriptScroll } from '@/hooks/useTranscriptScroll'

export function SiteAgent({ conversation: c }: { conversation: SiteAgentConversation }) {
  const origin = useSiteWorkspaceLocation()
  const { transcriptRef: transcript, onScroll, followLatest } = useTranscriptScroll(c.messages, { busy: c.busy })
  const composer = useRef<HTMLTextAreaElement>(null)
  const focusDraft = useRef(false)
  useLayoutEffect(() => {
    if (!focusDraft.current || c.busy || c.intent) return
    focusDraft.current = false
    composer.current?.focus()
  }, [c.busy, c.intent])

  return <div className="flex min-h-0 flex-1 flex-col">
    <div ref={transcript} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4" onScroll={onScroll}>
      {c.loading && !c.messages.length ? <p role="status" className="text-sm text-muted-foreground">{C.loading}</p> : null}
      {c.historyError ? <div role="alert" className="mb-4 text-sm text-muted-foreground"><p>{c.historyError}</p><Button variant="outline" className="mt-2" onClick={() => void c.loadHistory()}>{C.retryHistory}</Button></div> : null}
      {!c.loading && !c.historyError && !c.messages.length ? <div className="flex flex-col items-start gap-4 py-6">
        <p className="text-sm leading-relaxed text-muted-foreground">{C.empty}</p>
        <div className="flex flex-col items-start gap-2">
          {C.suggestions.map(suggestion => <Button key={suggestion} variant="secondary" size="sm" onClick={() => { c.changeQuestion(suggestion); composer.current?.focus() }}>{suggestion}</Button>)}
        </div>
      </div> : null}
      <ol aria-label={C.siteQuestions} aria-live="polite" aria-relevant="additions" className="flex flex-col gap-3">
        {c.messages.map(item => <li key={item.id}>
          <MessageBubble variant={item.role === 'user' ? 'visitor' : 'agent'}>
            <span className="sr-only">{item.role === 'user' ? C.you : C.assistant}: </span>
            <p className="whitespace-pre-wrap break-words">{item.content}</p>
            {item.citations.length ? <ul aria-label={C.sources} className="mt-2">
              {item.citations.map(citation => <li key={`${citation.type}:${citation.id}`}><Link href={siteDetailContextHref(citation.href, origin) as Route} className="inline-flex min-h-11 max-w-full items-center text-sm text-link hover:underline [overflow-wrap:anywhere] focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{citation.label}</Link></li>)}
            </ul> : null}
          </MessageBubble>
        </li>)}
      </ol>
      {c.busy ? <p role="status" className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 size={14} className="motion-safe:animate-spin" aria-hidden />{C.pending}</p> : null}
    </div>
    <form onSubmit={event => { event.preventDefault(); followLatest(); void c.send() }} className="shrink-0 space-y-2 p-3">
      {c.intent && !c.busy ? <p className="text-xs text-muted-foreground">{C.interrupted}</p> : null}
      <SiteActionFeedback message={c.error?.message ?? null} error={c.error} siteId={c.siteId} />
      <div className="flex items-end gap-2">
        <ChatComposer ref={composer} value={c.question} onChange={c.changeQuestion} label={C.question} placeholder={C.placeholder}
          maxLength={2000} disabled={c.busy || Boolean(c.intent)} />
        <Button type="submit" size="icon" disabled={!c.canSend} aria-label={c.busy ? C.sending : c.intent ? C.retry : C.send}>
          <ArrowUp aria-hidden />
        </Button>
      </div>
      {c.intent && !c.busy && c.error?.code !== 'AGENT_PENDING' ? <Button type="button" variant="ghost" size="sm" onClick={() => { focusDraft.current = true; c.newMessage() }}>{C.newMessage}</Button> : null}
    </form>
  </div>
}
