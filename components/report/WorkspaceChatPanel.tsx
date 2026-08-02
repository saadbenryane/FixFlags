'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { REPORT_COPY } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

interface WorkspaceChatPanelProps {
  auditId: string
  /** Owner-only chat. Non-owners get no chat panel at all. */
  canChat?: boolean
  className?: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface ChatMeta {
  available: boolean
  cap: number
  userTurns: number
}

const chatCopy = REPORT_COPY.workspace.chat

const QUICK_PROMPTS = [chatCopy.cannedExplain, chatCopy.cannedFirst]

export function WorkspaceChatPanel({
  auditId,
  canChat = true,
  className,
}: WorkspaceChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [meta, setMeta] = useState<ChatMeta>({ available: true, cap: 20, userTurns: 0 })
  const [capReached, setCapReached] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/reports/${auditId}/chat`)
      .then((response) => response.json().catch(() => ({})))
      .then((data) => {
        if (cancelled) return
        const history = Array.isArray(data?.messages)
          ? (data.messages as { role: 'user' | 'assistant'; content: string }[]).map(
              (message, index) => ({
                id: `history-${index}`,
                role: message.role,
                content: message.content,
              })
            )
          : []
        setMessages(history)
        const userTurns = typeof data?.userTurns === 'number' ? data.userTurns : 0
        const cap = typeof data?.cap === 'number' ? data.cap : 20
        setMeta({
          available: data?.available !== false,
          cap,
          userTurns,
        })
        setCapReached(userTurns >= cap)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setHistoryLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [auditId])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading) return
    const userMessage: ChatMessage = {
      id: `local-${Date.now()}-user`,
      role: 'user',
      content: trimmed,
    }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)
    try {
      const response = await fetch(`/api/reports/${auditId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      })
      const data = (await response.json().catch(() => ({}))) as {
        reply?: string
        error?: string
        capReached?: boolean
        cap?: number
        userTurns?: number
      }
      if (typeof data.userTurns === 'number') {
        setMeta((current) => ({ ...current, userTurns: data.userTurns as number }))
      }
      if (data.capReached) {
        setCapReached(true)
        if (typeof data.cap === 'number') {
          setMeta((current) => ({ ...current, cap: data.cap as number }))
        }
      }
      const reply =
        typeof data.reply === 'string'
          ? data.reply
          : typeof data.error === 'string'
            ? data.error
            : chatCopy.unavailable
      setMessages((prev) => [
        ...prev,
        { id: `local-${Date.now()}-assistant`, role: 'assistant', content: reply },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `local-${Date.now()}-assistant`, role: 'assistant', content: chatCopy.unavailable },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleSend() {
    void send(input)
  }

  if (!canChat) return null

  const liveChat = meta.available && !capReached

  return (
    <div
      className={cn('flex min-h-[200px] flex-col rounded-card border border-border bg-card/50', className)}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="text-xs font-semibold text-muted-foreground">{chatCopy.title}</span>
        <span className="rounded-full bg-muted/50 px-2 py-0.5 text-2xs text-muted-foreground">
          {meta.userTurns}/{meta.cap}
        </span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
        {messages.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {historyLoaded ? chatCopy.empty : chatCopy.unavailable}
          </p>
        ) : (
          messages.map((msg) => (
            <p
              key={msg.id}
              className={msg.role === 'user' ? 'text-foreground' : 'text-muted-foreground'}
            >
              <span className="font-medium">{msg.role === 'user' ? 'You' : 'FixFlags'}:</span>{' '}
              {msg.content}
            </p>
          ))
        )}
      </div>

      {liveChat ? (
        <form
          className="flex gap-2 border-t border-border p-2"
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={chatCopy.placeholder}
            disabled={loading}
            className="text-sm"
          />
          <Button type="submit" size="sm" loading={loading} disabled={!input.trim()}>
            {chatCopy.send}
          </Button>
        </form>
      ) : (
        <div className="space-y-2 border-t border-border p-3">
          <p className="text-xs text-muted-foreground">
            {capReached ? chatCopy.capReached(meta.cap) : chatCopy.notConfigured}
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                disabled={loading}
                className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                onClick={() => void send(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
