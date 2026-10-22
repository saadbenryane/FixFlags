'use client'

import { useState } from 'react'
import { Copy, Check, FileText, Code } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useCopyToClipboard } from '@/lib/hooks/useCopyToClipboard'

interface PromptPreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  prompt: string
  title?: string
  description?: string
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export function PromptPreviewModal({
  open,
  onOpenChange,
  prompt,
  title = 'Fix prompt preview',
  description = 'Review the prompt before copying it to your clipboard.',
}: PromptPreviewModalProps) {
  const { copied, copy } = useCopyToClipboard()
  const [format, setFormat] = useState<'plain' | 'markdown'>('plain')

  const displayPrompt = format === 'markdown' ? promptToMarkdown(prompt) : prompt
  const wordCount = prompt.split(/\s+/).filter(Boolean).length
  const tokenEstimate = estimateTokens(prompt)

  async function handleCopy() {
    await copy(displayPrompt, { kind: 'export', successMessage: 'Prompt copied' })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent header={<DialogTitle>{title}</DialogTitle>} className="max-w-2xl max-h-[80dvh]">
        <DialogDescription>{description}</DialogDescription>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={format === 'plain' ? 'secondary' : 'ghost'}
            size="xs"
            onClick={() => setFormat('plain')}
            className="gap-1.5"
          >
            <FileText className="h-3 w-3" aria-hidden />
            Plain text
          </Button>
          <Button
            variant={format === 'markdown' ? 'secondary' : 'ghost'}
            size="xs"
            onClick={() => setFormat('markdown')}
            className="gap-1.5"
          >
            <Code className="h-3 w-3" aria-hidden />
            Markdown
          </Button>
          <span className="ml-auto text-2xs text-muted-foreground">
            ~{wordCount} words / ~{tokenEstimate} tokens
          </span>
        </div>

        <div className="min-w-0">
          <pre className="rounded-card bg-terminal p-4 font-mono text-2xs leading-relaxed text-terminal-foreground whitespace-pre-wrap break-words min-h-[200px]">
            {displayPrompt}
          </pre>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button size="sm" onClick={handleCopy} className="gap-1.5">
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" aria-hidden />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" aria-hidden />
                Copy to clipboard
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function promptToMarkdown(prompt: string): string {
  // Expert prompts are already Markdown (`## Why`, etc.). Light-touch legacy labels only.
  return prompt
    .replace(/^(Fix|Why it matters|Why|Evidence|Verify|Scope):\s*/gm, '**$1:** ')
    .replace(/^(\d+\.\s)/gm, '$1')
}
