'use client'

import { useState, useEffect } from 'react'
import { EditorMark, type EditorMarkName } from '@/components/brand/EditorMarks'
import {
  BUILDERS,
  type PromptToolKey,
} from '@/lib/mcp/builders'
import { cn } from '@/lib/utils'

export type { PromptToolKey } from '@/lib/mcp/builders'
export { resolveToolPrompt } from '@/lib/mcp/builders'

interface ToolOption {
  key: PromptToolKey
  label: string
  editorMark: EditorMarkName | 'other'
}

const EDITOR_MARKS: Record<PromptToolKey, EditorMarkName | 'other'> = {
  universal: 'other',
  cursor: 'Cursor',
  claude: 'Claude Code',
  windsurf: 'Windsurf',
  lovable: 'Lovable',
  bolt: 'Bolt',
}

const TOOL_OPTIONS: ToolOption[] = BUILDERS.map((builder) => ({
  key: builder.key,
  label: builder.label,
  editorMark: EDITOR_MARKS[builder.key],
}))

const STORAGE_KEY = 'ff_preferredEditor'

function getStoredPreference(): PromptToolKey {
  if (typeof window === 'undefined') return 'universal'
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && TOOL_OPTIONS.some((t) => t.key === stored)) return stored as PromptToolKey
  } catch {
    // localStorage unavailable
  }
  return 'universal'
}

function storePreference(key: PromptToolKey) {
  try {
    localStorage.setItem(STORAGE_KEY, key)
  } catch {
    // localStorage unavailable
  }
}

interface PromptToolSelectorProps {
  toolPrompts: Partial<Record<PromptToolKey, string | null | undefined>>
  selectedTool: PromptToolKey
  onSelect: (tool: PromptToolKey) => void
  className?: string
}

export function PromptToolSelector({
  toolPrompts,
  selectedTool,
  onSelect,
  className,
}: PromptToolSelectorProps) {
  const availableTools = TOOL_OPTIONS.filter((opt) => {
    if (opt.key === 'universal') return true
    return toolPrompts[opt.key]?.trim()
  })

  if (availableTools.length <= 1) return null

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {availableTools.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => {
            onSelect(opt.key)
            storePreference(opt.key)
          }}
          className={cn(
            'inline-flex min-h-11 items-center gap-1 rounded-full px-3 py-1 text-2xs font-medium transition-colors',
            'border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
            selectedTool === opt.key
              ? 'border-brand bg-brand/10 text-brand'
              : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
          aria-pressed={selectedTool === opt.key}
        >
          <EditorMark name={opt.editorMark} className="h-3 w-3 shrink-0" />
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function usePreferredTool(
  defaultTool?: PromptToolKey
): [PromptToolKey, (tool: PromptToolKey) => void] {
  const [preferred, setPreferred] = useState<PromptToolKey>(defaultTool ?? 'universal')

  useEffect(() => {
    const stored = getStoredPreference()
    if (stored !== 'universal' || !defaultTool) {
      setPreferred(stored)
      return
    }
    setPreferred(defaultTool)
  }, [defaultTool])

  return [preferred, setPreferred]
}
