'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { useEffect, useState } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import type { AgentCitation } from '@/lib/sites/application/agent'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations: AgentCitation[]
}

const SUGGESTIONS = ['What should I fix first?', "What's still open?", 'What changed?']

export function SiteAgentPanel({ siteId }: { siteId: string }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    void fetch(`/api/sites/${siteId}/agent`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load the Agent.')
        const body = await response.json() as { messages: Message[] }
        setMessages(body.messages)
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Could not load the Agent.'))
  }, [open, siteId])

  async function send(message = input) {
    const trimmed = message.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setError(null)
    setInput('')
    const optimistic: Message = { id: `local-${Date.now()}`, role: 'user', content: trimmed, citations: [] }
    setMessages((current) => [...current, optimistic])
    try {
      const response = await fetch(`/api/sites/${siteId}/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      })
      const body = await response.json().catch(() => ({})) as { reply?: string; citations?: AgentCitation[]; messageId?: string; error?: string }
      if (!response.ok || !body.reply) throw new Error(body.error ?? 'The Agent could not answer.')
      setMessages((current) => [...current, {
        id: body.messageId ?? `agent-${Date.now()}`,
        role: 'assistant',
        content: body.reply!,
        citations: body.citations ?? [],
      }])
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'The Agent could not answer.')
    } finally {
      setBusy(false)
    }
  }

  async function escalate() {
    setBusy(true)
    const summary = messages.slice(-6).map((message) => `${message.role}: ${message.content}`).join('\n').slice(0, 4000)
    const response = await fetch('/api/support/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: siteId,
        pageUrl: window.location.href,
        transcriptSummary: summary,
        firstMessage: 'I need human help with this Site. Please review the attached Agent context.',
      }),
    })
    setBusy(false)
    setError(response.ok ? 'Support has the Site and recent Agent context. We’ll reply in Help chat.' : 'Could not contact support. Open Help to reach us directly.')
  }

  return (
    <>
      <Button
        type="button"
        variant="brand"
        className="fixed bottom-20 right-4 z-40 min-h-11 rounded-full shadow-lg lg:bottom-6 lg:right-6"
        onClick={() => setOpen(true)}
        aria-label="Open FixFlags Agent"
      >
        <MessageCircle className="h-4 w-4" aria-hidden /> Agent
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85dvh] max-w-xl flex-col overflow-hidden p-0">
          <div className="border-b border-border p-5">
            <DialogTitle>FixFlags Agent</DialogTitle>
            <DialogDescription>Answers use this Site’s saved evidence. Only Verify can certify a fix.</DialogDescription>
          </div>
          <div className="min-h-48 flex-1 space-y-3 overflow-y-auto p-5" aria-live="polite">
            {messages.length === 0 ? (
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((suggestion) => <Button key={suggestion} size="sm" variant="outline" onClick={() => void send(suggestion)}>{suggestion}</Button>)}
              </div>
            ) : messages.map((message) => (
              <div key={message.id} className={message.role === 'user' ? 'ml-8 rounded-2xl bg-muted p-3' : 'mr-8 rounded-2xl border border-border p-3'}>
                <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                {message.citations.length ? <ul className="mt-3 space-y-1 border-t border-border/60 pt-2">
                  {message.citations.map((citation) => <li key={`${citation.type}:${citation.id}`}><Link className="text-sm text-brand hover:underline" href={citation.href as Route}>{citation.label}</Link></li>)}
                </ul> : null}
              </div>
            ))}
            {error ? <p className="text-sm text-muted-foreground" role="status">{error}</p> : null}
          </div>
          <form className="flex gap-2 border-t border-border p-4" onSubmit={(event) => { event.preventDefault(); void send() }}>
            <label htmlFor="site-agent-message" className="sr-only">Ask about this Site</label>
            <input id="site-agent-message" className="min-h-11 min-w-0 flex-1 rounded-[var(--radius-control)] border border-border bg-background px-3" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about this Site" />
            <Button type="submit" variant="brand" disabled={busy || !input.trim()} aria-label="Send message"><Send className="h-4 w-4" /></Button>
          </form>
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => void escalate()}>Talk to support</Button>
            <Link href="/help" className="text-muted-foreground hover:text-foreground">Help center</Link>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
