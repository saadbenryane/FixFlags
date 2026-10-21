'use client'

import { InteractiveTextarea } from '@/components/ui/interactive-controls'
import { useLayoutEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

/** Shared compact composer, including IME-safe keyboard submission. */
export function ChatComposer({ value, onChange, label, placeholder, maxLength, disabled }: {
  value: string; onChange: (value: string) => void; label: string; placeholder: string; maxLength?: number; disabled?: boolean
}) {
  const textarea = useRef<HTMLTextAreaElement>(null)
  const composing = useRef(false)
  useLayoutEffect(() => {
    if (!textarea.current) return
    textarea.current.style.height = 'auto'
    textarea.current.style.height = `${Math.min(144, Math.max(44, textarea.current.scrollHeight))}px`
  }, [value])
  return <InteractiveTextarea ref={textarea} value={value} aria-label={label} placeholder={placeholder} rows={1} maxLength={maxLength}
    disabled={disabled} onChange={event => onChange(event.target.value)}
    onCompositionStart={() => { composing.current = true }} onCompositionEnd={() => { composing.current = false }}
    onKeyDown={event => {
      if (event.key === 'Enter' && !event.shiftKey && !composing.current && !event.nativeEvent.isComposing && event.keyCode !== 229) {
        event.preventDefault()
        event.currentTarget.form?.requestSubmit()
      }
    }}
    className={cn('min-h-11 min-w-0 flex-1 resize-none rounded-control border border-border bg-background px-3 py-2.5 text-sm leading-relaxed',
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-70')} />
}
