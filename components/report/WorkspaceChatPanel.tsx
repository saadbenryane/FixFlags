'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { REPORT_COPY } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

interface WorkspaceChatPanelProps {
  auditId: string
  className?: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const chatCopy = REPORT_COPY.workspace.chat

export function WorkspaceChatPanel({ auditId, className }: WorkspaceChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)

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
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setHistoryLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [auditId])

  async function handleSend() {
    const trimmed = input.trim()
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

  return (
    <div
      className={cn('flex min-h-[200px] flex-col rounded-card border border-border bg-card/50', className)}
    >
      <div className="border-b border-border px-3 py-2 text-xs font-semibold text-muted-foreground">
        {chatCopy.title}
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
    </div>
  )
}
