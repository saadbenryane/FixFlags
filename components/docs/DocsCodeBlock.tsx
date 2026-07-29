'use client'

import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

export function DocsCodeBlock({
  code,
  label = 'Code',
}: {
  code: string
  label?: string
}) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <figure className="my-6 overflow-hidden rounded-[var(--radius-card)] border border-border/70 bg-foreground text-background shadow-sm">
      <figcaption className="flex min-h-11 items-center justify-between border-b border-background/15 px-4">
        <span className="font-mono text-xs font-semibold uppercase tracking-label text-background/65">
          {label}
        </span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-control)] px-2 text-xs font-semibold text-background/75 hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </figcaption>
      <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-words p-4 font-mono text-[0.8125rem] leading-6">
        <code>{code}</code>
      </pre>
    </figure>
  )
}
