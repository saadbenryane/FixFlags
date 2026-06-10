'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Check, ChevronDown, Copy } from 'lucide-react'

interface Props {
  areaPrompt: string
  cursorPrompt?: string | null
  claudePrompt?: string | null
  lovablePrompt?: string | null
  boltPrompt?: string | null
}

const TOOLS = [
  { key: 'generic', label: 'Generic' },
  { key: 'cursor', label: 'Cursor' },
  { key: 'claude', label: 'Claude Code' },
  { key: 'lovable', label: 'Lovable' },
  { key: 'bolt', label: 'Bolt' },
]

export function AreaPromptButton({ areaPrompt, cursorPrompt, claudePrompt, lovablePrompt, boltPrompt }: Props) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const prompts: Record<string, string | null | undefined> = {
    generic: areaPrompt,
    cursor: cursorPrompt,
    claude: claudePrompt,
    lovable: lovablePrompt,
    bolt: boltPrompt,
  }

  async function copy(key: string) {
    const prompt = prompts[key] ?? areaPrompt
    await navigator.clipboard.writeText(prompt)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
    setOpen(false)
  }

  return (
    <div className="relative inline-block">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(!open)}
        className="gap-1"
      >
        <Copy className="h-3 w-3" />
        Copy area prompt
        <ChevronDown className="h-3 w-3" />
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 w-40 rounded-md border bg-popover shadow-md">
            {TOOLS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => copy(key)}
                className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-accent transition-colors"
              >
                {label}
                {copied === key && <Check className="h-3 w-3 text-green-500" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
