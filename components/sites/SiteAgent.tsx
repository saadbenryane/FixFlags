'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { ArrowUp, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChatComposer } from '@/components/ui/chat-composer'
import { MessageBubble } from '@/components/support/MessageBubble'
import { SiteActionFeedback } from './SiteActionFeedback'
import type { SiteAgentConversation } from '@/hooks/useSiteAgentConversation'
import { SITE_AGENT_COPY as C } from '@/lib/marketing/copy/site-agent'

export function SiteAgent({ conversation: c }: { conversation: SiteAgentConversation }) {
  const transcript = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  useEffect(() => {
    if (stickToBottom.current && transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight
  }, [c.messages, c.busy])

  return <div className="flex min-h-0 flex-1 flex-col">
    <div ref={transcript} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4" onScroll={event => {
      const node = event.currentTarget
      stickToBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 60
    }}>
      {c.loading && !c.messages.length ? <p role="status" className="text-sm text-muted-foreground">{C.loading}</p> : null}
      {c.historyError ? <div role="alert" className="mb-4 text-sm text-muted-foreground"><p>{c.historyError}</p><Button variant="outline" className="mt-2" onClick={() => void c.loadHistory()}>{C.retryHistory}</Button></div> : null}
      {!c.loading && !c.historyError && !c.messages.length ? <div className="flex flex-col items-start gap-4 py-6">
        <p className="text-sm leading-relaxed text-muted-foreground">{C.empty}</p>
        <div className="flex flex-col items-start gap-2">
          {C.suggestions.map(suggestion => <Button key={suggestion} variant="secondary" size="sm" onClick={() => c.changeQuestion(suggestion)}>{suggestion}</Button>)}
        </div>
      </div> : null}
      <ol aria-label={C.siteQuestions} aria-live="polite" aria-relevant="additions" className="flex flex-col gap-3">
        {c.messages.map(item => <li key={item.id}>
          <MessageBubble variant={item.role === 'user' ? 'visitor' : 'agent'}>
            <span className="sr-only">{item.role === 'user' ? C.you : C.assistant}: </span>
            <p className="whitespace-pre-wrap break-words">{item.content}</p>
            {item.citations.length ? <ul aria-label={C.sources} className="mt-2">
              {item.citations.map(citation => <li key={`${citation.type}:${citation.id}`}><Link href={citation.href as Route} className="inline-flex min-h-11 items-center text-sm text-link hover:underline">{citation.label}</Link></li>)}
            </ul> : null}
          </MessageBubble>
        </li>)}
      </ol>
      {c.busy ? <p role="status" className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 size={14} className="motion-safe:animate-spin" aria-hidden />{C.pending}</p> : null}
    </div>
    <form onSubmit={event => { event.preventDefault(); stickToBottom.current = true; void c.send() }} className="shrink-0 space-y-2 p-3">
      {c.intent && !c.busy ? <p className="text-xs text-muted-foreground">{C.interrupted}</p> : null}
      <SiteActionFeedback message={c.error?.message ?? null} error={c.error} siteId={c.siteId} />
      <div className="flex items-end gap-2">
        <ChatComposer value={c.question} onChange={c.changeQuestion} label={C.question} placeholder={C.placeholder}
          maxLength={2000} disabled={c.busy || Boolean(c.intent)} />
        <Button type="submit" size="icon" disabled={!c.canSend} aria-label={c.busy ? C.sending : c.intent ? C.retry : C.send}>
          <ArrowUp aria-hidden />
        </Button>
      </div>
      {c.intent && !c.busy && c.error?.code !== 'AGENT_PENDING' ? <Button type="button" variant="ghost" size="sm" onClick={c.newMessage}>{C.newMessage}</Button> : null}
    </form>
  </div>
}
