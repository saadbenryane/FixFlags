'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { MessageCircle } from 'lucide-react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { ResponsiveDepth } from './ResponsiveDepth'
import { SiteActionFeedback } from './SiteActionFeedback'
import { agentHistorySchema } from '@/lib/sites/agent-contract'
import { executeSiteAction } from '@/lib/sites/client-actions'
import { useSiteAction } from '@/hooks/useSiteAction'
import { SITE_AGENT_COPY as C } from '@/lib/marketing/copy/site-agent'

const intentSchema = z.object({ requestKey: z.string().min(1), message: z.string().min(1).max(2000) }).strict()
type MessageIntent = z.infer<typeof intentSchema>
type History = z.infer<typeof agentHistorySchema>

export function SiteAgent({ siteId, flagId }: { siteId: string; flagId?: string }) {
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [intent, setIntent] = useState<MessageIntent | null>(null)
  const [history, setHistory] = useState<History | null>(null)
  const [loading, setLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const { busy, error, message, submit, isPending } = useSiteAction()
  const storageKey = `fixflags:agent:${siteId}:${flagId ?? 'site'}`
  const controller = useRef<AbortController | null>(null)

  useEffect(() => {
    setOpen(false); setIntent(null); setQuestion(''); setHistory(null)
    try {
      const saved = intentSchema.safeParse(JSON.parse(sessionStorage.getItem(storageKey) ?? 'null'))
      if (saved.success) { setIntent(saved.data); setQuestion(saved.data.message) }
    } catch { /* No stored customer intent is available. */ }
    return () => controller.current?.abort()
  }, [storageKey])

  async function loadHistory() {
    controller.current?.abort()
    const request = new AbortController()
    controller.current = request
    setLoading(true); setHistoryError(null)
    try {
      const response = await fetch(`/api/sites/${siteId}/agent`, { cache: 'no-store', signal: request.signal })
      if (!response.ok) throw new Error(C.historyFailed)
      const saved = agentHistorySchema.parse(await response.json())
      if (saved.messages.some(item => item.citations.some(citation => !citation.href.startsWith(`/sites/${siteId}/`) && !citation.href.startsWith(`/sites/${siteId}?`)))) throw new Error(C.invalid)
      setHistory(saved)
    } catch {
      if (!request.signal.aborted) setHistoryError(C.historyFailed)
    } finally { if (!request.signal.aborted) setLoading(false) }
  }

  function saveIntent(value: MessageIntent | null) {
    setIntent(value)
    try { if (value) sessionStorage.setItem(storageKey, JSON.stringify(value)); else sessionStorage.removeItem(storageKey) }
    catch { /* In-memory submission ownership still retains an interrupted intent. */ }
  }

  async function send() {
    if (isPending() || busy || !question.trim()) return
    const submitted = intent ?? { requestKey: `web:${crypto.randomUUID()}`, message: question.trim() }
    saveIntent(submitted)
    await submit(() => executeSiteAction(`/api/sites/${siteId}/agent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': submitted.requestKey },
      body: JSON.stringify({ message: submitted.message, ...(flagId ? { flagId } : {}) }),
    }, 'agentReply'), body => {
      setHistory(current => ({ threadId: body.threadId, messages: [...(current?.messages ?? []).filter(item => item.id !== body.messageId),
        { id: body.messageId, role: 'assistant', content: body.reply, citations: body.citations, createdAt: body.createdAt, flagId: flagId ?? null }] }))
      saveIntent(null); setQuestion(''); return C.replied
    }, loadHistory)
  }

  const visibleMessages = (history?.messages ?? []).filter(item => !flagId || item.flagId === flagId)
  return <>
    <Button variant="outline" size="sm" className="min-h-11" onClick={() => { setOpen(true); void loadHistory() }}>
      <MessageCircle size={16} aria-hidden />{C.title}
    </Button>
    <ResponsiveDepth open={open} onOpenChange={setOpen}>
      <DialogTitle>{C.title}</DialogTitle>
      <DialogDescription>{flagId ? C.flagDescription : C.description}</DialogDescription>
      <p className="text-sm text-muted-foreground">{C.boundary}</p>
      {loading && !history ? <p role="status" className="text-sm">{C.loading}</p> : null}
      {historyError ? <div role="alert"><p className="text-sm">{historyError}</p><Button variant="outline" className="mt-2" onClick={() => void loadHistory()}>{C.retryHistory}</Button></div> : null}
      {history && !visibleMessages.length ? <p className="text-sm text-muted-foreground">{C.empty}</p> : null}
      <ol className="flex max-h-[40dvh] flex-col gap-4 overflow-y-auto" aria-label={C.title}>
        {visibleMessages.map(item => <li key={item.id} className="rounded-card border border-border bg-muted/20 p-4">
          <p className="mb-2 text-sm font-semibold">{item.role === 'user' ? C.you : C.assistant}</p>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{item.content}</p>
          {item.citations.length ? <ul aria-label={C.sources} className="mt-3 flex flex-col gap-1">
            {item.citations.map(citation => <li key={`${citation.type}:${citation.id}`}><Link href={citation.href as Route} className="inline-flex min-h-11 items-center text-sm text-link">{citation.label}</Link></li>)}
          </ul> : null}
        </li>)}
      </ol>
      <form onSubmit={event => { event.preventDefault(); void send() }} className="flex flex-col gap-3">
        <label htmlFor={`agent-question-${flagId ?? siteId}`} className="text-sm font-medium">{C.question}</label>
        <textarea id={`agent-question-${flagId ?? siteId}`} value={question} maxLength={2000} rows={3}
          placeholder={C.placeholder} disabled={busy || Boolean(intent)} onChange={event => setQuestion(event.target.value)}
          className="w-full resize-y rounded-control border border-border bg-background p-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-70" />
        {intent && !busy ? <p className="text-sm text-muted-foreground">{C.interrupted}</p> : null}
        <SiteActionFeedback message={message} error={error} siteId={siteId} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="brand" disabled={busy || !question.trim()}>{busy ? C.sending : intent ? C.retry : C.send}</Button>
          {intent && !busy && error?.code !== 'AGENT_PENDING' ? <Button type="button" variant="outline" onClick={() => saveIntent(null)}>{C.newMessage}</Button> : null}
        </div>
      </form>
    </ResponsiveDepth>
  </>
}
