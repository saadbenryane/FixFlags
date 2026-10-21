'use client'

import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCopyToClipboard } from '@/lib/hooks/useCopyToClipboard'
import { DOCS_CODE_COPY as C } from '@/lib/marketing/copy/public-site'

export function DocsCodeBlock({
  code,
  label = C.defaultLabel,
}: {
  code: string
  label?: string
}) {
  const { copied, copy } = useCopyToClipboard()

  return (
    <figure className="my-6 overflow-hidden rounded-[var(--radius-card)] border border-border/70 bg-foreground text-background shadow-sm">
      <figcaption className="flex min-h-11 items-center justify-between px-4">
        <span className="font-mono text-xs font-semibold uppercase tracking-label text-background/65">
          {label}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!code.trim()}
          onClick={() => { void copy(code) }}
          className="gap-2 px-2 text-xs font-semibold text-background/75 hover:bg-background/10 hover:text-background focus-visible:ring-brand"
          aria-label={C.accessibleCopy(label)}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? C.copied : C.copy}
        </Button>
      </figcaption>
      <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-words p-4 font-mono text-[0.8125rem] leading-6">
        <code>{code}</code>
      </pre>
    </figure>
  )
}
