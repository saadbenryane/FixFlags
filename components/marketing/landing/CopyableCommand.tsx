'use client'

import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

interface CopyableCommandProps {
  command: string
  label: string
  description?: string
}

export function CopyableCommand({ command, label, description }: CopyableCommandProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(command)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="not-prose">
      <div className="flex items-center gap-2 rounded-[var(--radius-control)] border border-border/50 bg-muted/40 px-4 py-3">
        <span className="shrink-0 font-mono text-[0.6875rem] font-semibold uppercase tracking-label text-muted-foreground">
          {label}
        </span>
        <code className="min-w-0 flex-1 overflow-x-auto font-mono text-sm text-foreground">
          {command}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors duration-150 hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      {description ? (
        <p className="mt-1.5 text-xs text-muted-foreground">{description}</p>
      ) : null}
    </div>
  )
}
