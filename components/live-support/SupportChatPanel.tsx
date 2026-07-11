'use client'

import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MessageBubble } from '@/components/support/MessageBubble'
import type { SupportMessageDto } from '@/lib/live-support/types'
import { useSupportContext } from '@/components/live-support/SupportProvider'
import { useSupportMessages } from '@/components/live-support/useSupportPolling'

export function SupportChatPanel({ auditId }: { auditId?: string | null }) {
  const { sessionId, setSessionId, auditId: contextAuditId } = useSupportContext()
  const resolvedAuditId = auditId ?? contextAuditId
  const { panelOpen } = useSupportContext()
  const { data, mutate } = useSupportMessages(sessionId, panelOpen)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [data?.messages])

  useEffect(() => {
    if (!sessionId || !panelOpen) return
    void fetch(`/api/support/sessions/${sessionId}/messages`, { method: 'PATCH' })
  }, [sessionId, panelOpen, data?.messages?.length])

  async function ensureSession() {
    if (sessionId) return sessionId
    const res = await fetch('/api/support/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pageUrl: window.location.href,
        auditId: resolvedAuditId ?? undefined,
      }),
    })
    if (!res.ok) throw new Error('Could not start chat')
    const json = (await res.json()) as { session: { id: string } }
    setSessionId(json.session.id)
    return json.session.id
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || sending) return

    setSending(true)
    setError(null)
    try {
      const id = await ensureSession()
      const res = await fetch(`/api/support/sessions/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.message ?? 'Failed to send')
      }
      setDraft('')
      await mutate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  const messages = data?.messages ?? []

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4 min-h-0">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Ask us anything about FixFlags, your audit, or getting started.
          </p>
        )}
        {messages.map((m) => {
          if (m.role === 'SYSTEM') {
            return <p key={m.id} className="text-center text-xs text-muted-foreground px-2 py-1">{m.body}</p>
          }
          return (
            <MessageBubble key={m.id} variant={m.role === 'VISITOR' ? 'visitor' : 'agent'}>
              {m.body}
            </MessageBubble>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="border-t border-border p-3 space-y-2">
        {error && (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a message…"
            rows={2}
            className="flex-1 resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleSend(e)
              }
            }}
          />
          <Button type="submit" size="icon" disabled={sending || !draft.trim()} aria-label="Send message">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  )
}
