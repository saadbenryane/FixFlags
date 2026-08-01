'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface WorkspaceChatPanelProps {
  auditId: string
  className?: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export function WorkspaceChatPanel({ auditId, className }: WorkspaceChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSend() {
    const trimmed = input.trim()
    if (!trimmed || loading) return
    const userMessage: ChatMessage = { role: 'user', content: trimmed }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)
    try {
      const response = await fetch(`/api/reports/${auditId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      })
      const data = (await response.json().catch(() => ({}))) as { reply?: string; error?: string }
      const reply =
        typeof data.reply === 'string'
          ? data.reply
          : typeof data.error === 'string'
            ? data.error
            : 'Could not reach FixFlags chat right now.'
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Could not reach FixFlags chat right now.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn('flex min-h-[200px] flex-col rounded-lg border border-border bg-card/50', className)}>
      <div className="border-b border-border px-3 py-2 text-xs font-semibold text-muted-foreground">
        Chat with FixFlags
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
        {messages.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            Ask what to fix first, or about a Flag on this report.
          </p>
        ) : (
          messages.map((msg, i) => (
            <p key={i} className={msg.role === 'user' ? 'text-foreground' : 'text-muted-foreground'}>
              <span className="font-medium">{msg.role === 'user' ? 'You' : 'FixFlags'}:</span> {msg.content}
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
          placeholder="What should I fix first?"
          disabled={loading}
          className="text-sm"
        />
        <Button type="submit" size="sm" loading={loading} disabled={!input.trim()}>
          Send
        </Button>
      </form>
    </div>
  )
}
