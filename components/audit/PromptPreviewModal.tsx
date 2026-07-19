'use client'

import { useState } from 'react'
import { Copy, Check, FileText, Code } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

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
  const [copied, setCopied] = useState(false)
  const [format, setFormat] = useState<'plain' | 'markdown'>('plain')

  const displayPrompt = format === 'markdown' ? promptToMarkdown(prompt) : prompt
  const wordCount = prompt.split(/\s+/).filter(Boolean).length
  const tokenEstimate = estimateTokens(prompt)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(displayPrompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select text for manual copy
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 px-6 pb-3">
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

        <div className="flex-1 overflow-auto mx-6 mb-2">
          <pre className="rounded-card bg-terminal p-4 font-mono text-2xs leading-relaxed text-terminal-foreground whitespace-pre-wrap break-words min-h-[200px] max-h-[50vh] overflow-auto">
            {displayPrompt}
          </pre>
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-6 py-4">
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
  return prompt
    .replace(/^(Fix|Why it matters|Evidence|Verify|Scope):\s*/gm, '**$1:** ')
    .replace(/^(\d+\.\s)/gm, '$1')
}
