'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { AI_CONNECTION_COPY } from '@/lib/marketing/copy/ai-connection'

const C = AI_CONNECTION_COPY.prompt

export function AgentConnectionPrompt() {
  const input = useRef<HTMLTextAreaElement>(null)
  const [message, setMessage] = useState('')

  async function copy() {
    try {
      await navigator.clipboard.writeText(C.body)
      setMessage(C.copied)
    } catch {
      setMessage(C.manual)
      input.current?.focus()
      input.current?.select()
    }
  }

  return <div className="space-y-3">
    <label htmlFor="agent-connection-prompt" className="block text-sm font-medium">{C.label}</label>
    <Textarea id="agent-connection-prompt" ref={input} readOnly value={C.body} rows={5}
      onFocus={event => event.currentTarget.select()} className="text-sm leading-relaxed" />
    <Button type="button" variant="outline" onClick={() => void copy()}>{C.copy}</Button>
    {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
  </div>
}
