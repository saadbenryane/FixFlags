'use client'

import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChatComposer } from '@/components/ui/chat-composer'
import { Textarea } from '@/components/ui/textarea'
import { MessageBubble } from '@/components/support/MessageBubble'
import { useSupportContext } from '@/components/live-support/SupportProvider'
import { useSupportMessages } from '@/components/live-support/useSupportPolling'
import { SUPPORT_CHAT } from '@/lib/marketing/copy-barrel'

export function SupportChatPanel({ auditId, composer, compact = false, onRead }: {
  auditId?: string | null
  compact?: boolean
  composer?: { draft: string; setDraft: (value: string) => void; sending: boolean; beginSend: () => boolean; endSend: () => void
    error: string | null; setError: (value: string | null) => void }
  onRead?: () => void
}) {
  const {
    sessionId,
    setSessionId,
    auditId: contextAuditId,
    panelOpen,
    draftPrefill,
    clearDraftPrefill,
  } = useSupportContext()
  const resolvedAuditId = auditId ?? contextAuditId
  const { data, mutate, error: pollError } = useSupportMessages(sessionId, panelOpen)
  const [localDraft, setLocalDraft] = useState('')
  const [localSending, setLocalSending] = useState(false)
  const draft = composer?.draft ?? localDraft
  const setDraft = composer?.setDraft ?? setLocalDraft
  const sending = composer?.sending ?? localSending
  const [localError, setLocalError] = useState<string | null>(null)
  const error = composer ? composer.error : localError
  const setError = composer?.setError ?? setLocalError
  const bottomRef = useRef<HTMLDivElement>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)

  useEffect(() => {
    if (draftPrefill) {
      setDraft(draftPrefill)
      clearDraftPrefill()
    }
  }, [draftPrefill, clearDraftPrefill, setDraft])

  useEffect(() => {
    if (compact) {
      if (stickToBottom.current && transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    } else {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      bottomRef.current?.scrollIntoView?.({ behavior: reducedMotion ? 'instant' : 'smooth' })
    }
  }, [data?.messages, compact])

  useEffect(() => {
    if (!sessionId || !panelOpen) return
    void fetch(`/api/support/sessions/${sessionId}/messages`, { method: 'PATCH' })
      .then(response => { if (response.ok) onRead?.() }).catch(() => undefined)
  }, [sessionId, panelOpen, data?.messages?.length, onRead])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || sending || (composer && !composer.beginSend())) return
    stickToBottom.current = true

    setLocalSending(true)
    setError(null)
    try {
      if (sessionId) {
        const res = await fetch(`/api/support/sessions/${sessionId}/messages`, {
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
      } else {
        const res = await fetch('/api/support/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pageUrl: window.location.href,
            auditId: resolvedAuditId ?? undefined,
            firstMessage: text,
          }),
        })
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          throw new Error(json.message ?? SUPPORT_CHAT.startError)
        }
        const json = (await res.json()) as { session: { id: string } | null }
        if (!json.session?.id) {
          throw new Error(SUPPORT_CHAT.startError)
        }
        setDraft('')
        // Setting sessionId switches the SWR key so messages load from the new session.
        setSessionId(json.session.id)
      }    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send')
    } finally {
      setLocalSending(false)
      composer?.endSend()
    }
  }

  const messages = data?.messages ?? []
  // Local welcome only before persistence; after send the server SYSTEM message is the source of truth.
  const showLocalWelcome = !sessionId

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={transcriptRef} className="flex-1 space-y-3 overflow-y-auto p-4 min-h-0" onScroll={event => {
        const node = event.currentTarget
        stickToBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 60
      }}>
        {pollError && messages.length === 0 && sessionId && (
          <p className="text-sm text-destructive text-center py-8" role="alert">
            Could not load messages. Try sending a message to reconnect.
          </p>
        )}
        {showLocalWelcome && (
          <p className="text-center text-xs text-muted-foreground px-2 py-1">
            {SUPPORT_CHAT.welcomeMessage}
          </p>
        )}
        {messages.map((m) => {
          if (m.role === 'SYSTEM') {
            return (
              <p key={m.id} className="text-center text-xs text-muted-foreground px-2 py-1">
                {m.body}
              </p>
            )
          }
          return (
            <MessageBubble key={m.id} variant={m.role === 'VISITOR' ? 'visitor' : 'agent'}>
              {m.body}
            </MessageBubble>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="shrink-0 space-y-2 p-3">
        {error && (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
        <div className={compact ? 'flex items-end gap-2' : 'flex gap-2'}>
          {compact ? <ChatComposer
            value={draft}
            onChange={setDraft}
            label={SUPPORT_CHAT.messageLabel}
            placeholder={SUPPORT_CHAT.messagePlaceholder}
            disabled={sending}
          /> : <Textarea value={draft} onChange={event => setDraft(event.target.value)} aria-label={SUPPORT_CHAT.messageLabel} placeholder={SUPPORT_CHAT.messagePlaceholder}
            rows={2} className="flex-1 resize-none" onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
                event.preventDefault()
                void handleSend(event)
              }
            }} />}
          <Button type="submit" size="icon" disabled={sending || !draft.trim()} aria-label={SUPPORT_CHAT.sendLabel}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  )
}
