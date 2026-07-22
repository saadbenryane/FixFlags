'use client'

import { useState, useEffect } from 'react'
import { EditorMark, type EditorMarkName } from '@/components/brand/EditorMarks'
import { cn } from '@/lib/utils'

export type PromptToolKey = 'universal' | 'cursor' | 'claude' | 'windsurf' | 'lovable' | 'bolt'

interface ToolOption {
  key: PromptToolKey
  label: string
  editorMark: EditorMarkName | 'other'
}

const TOOL_OPTIONS: ToolOption[] = [
  { key: 'universal', label: 'Universal', editorMark: 'other' },
  { key: 'cursor', label: 'Cursor', editorMark: 'Cursor' },
  { key: 'claude', label: 'Claude', editorMark: 'Claude Code' },
  { key: 'windsurf', label: 'Windsurf', editorMark: 'Windsurf' },
  { key: 'lovable', label: 'Lovable', editorMark: 'Lovable' },
  { key: 'bolt', label: 'Bolt', editorMark: 'Bolt' },
]

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

export function resolveToolPrompt(
  toolPrompts: Partial<Record<PromptToolKey, string | null | undefined>> | undefined,
  selectedTool: PromptToolKey,
  fallback: string
): string {
  if (!toolPrompts) return fallback
  const prompt = toolPrompts[selectedTool]
  if (prompt?.trim()) return prompt.trim()
  // Fallback chain: universal -> cursor -> first available
  if (selectedTool !== 'universal' && toolPrompts.universal?.trim()) return toolPrompts.universal.trim()
  if (toolPrompts.cursor?.trim()) return toolPrompts.cursor.trim()
  for (const opt of TOOL_OPTIONS) {
    if (toolPrompts[opt.key]?.trim()) return toolPrompts[opt.key]!.trim()
  }
  return fallback
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

export function usePreferredTool(): [PromptToolKey, (tool: PromptToolKey) => void] {
  const [preferred, setPreferred] = useState<PromptToolKey>('universal')

  useEffect(() => {
    setPreferred(getStoredPreference())
  }, [])

  return [preferred, setPreferred]
}
