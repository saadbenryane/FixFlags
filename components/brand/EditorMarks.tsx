import type { ReactNode } from 'react'
import { Terminal } from 'lucide-react'
import {
  EDITOR_MARK_NAMES,
  type EditorMarkName,
} from '@/lib/integrations/editor-catalog'

export { EDITOR_MARK_NAMES }
export type { EditorMarkName }

const SVG_MARKS: Record<EditorMarkName, ReactNode> = {
  Cursor: (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
      <path d="M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23" />
    </svg>
  ),
  Codex: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden fill="none">
      <path
        d="M12 2.6a4.4 4.4 0 0 1 4.12 2.86 4.4 4.4 0 0 1 4.04 6.75 4.4 4.4 0 0 1-4.12 6.33 4.4 4.4 0 0 1-8.08 0 4.4 4.4 0 0 1-4.12-6.33 4.4 4.4 0 0 1 4.04-6.75A4.4 4.4 0 0 1 12 2.6Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M8.45 12 11 9.45M13 14.55 15.55 12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  Lovable: (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
      <path d="M12 21.15C6.47 16.22 2 12.2 2 7.9 2 4.72 4.38 2.6 7.22 2.6c1.86 0 3.6.94 4.78 2.7 1.18-1.76 2.92-2.7 4.78-2.7C19.62 2.6 22 4.72 22 7.9c0 4.3-4.47 8.32-10 13.25Z" />
    </svg>
  ),
  Bolt: (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
      <path d="M13.25 2.5 4.5 13.35h6.15L9.9 21.5l9.6-12.1h-6.25V2.5Z" />
    </svg>
  ),
  Replit: (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
      <path d="M4 3.5A1.5 1.5 0 0 1 5.5 2h5A1.5 1.5 0 0 1 12 3.5v17A1.5 1.5 0 0 1 10.5 22h-5A1.5 1.5 0 0 1 4 20.5V3.5Zm11 0A1.5 1.5 0 0 1 16.5 2h2A1.5 1.5 0 0 1 20 3.5v5A1.5 1.5 0 0 1 18.5 10h-2A1.5 1.5 0 0 1 15 8.5v-5Z" />
    </svg>
  ),
  'Claude Code': (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden fill="none">
      <path d="M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="m8 12 2.1-2.1M8 12l2.1 2.1M16 12l-2.1-2.1M16 12l-2.1 2.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  Windsurf: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden fill="none">
      <path d="M3 15.5c3.4-4.8 7.15-7.2 11.25-7.2 2.25 0 4.5.72 6.75 2.15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M5 18.5c2.25-2.45 4.78-3.68 7.6-3.68 1.9 0 3.7.45 5.4 1.35" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8.75 5.5 13.25 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  Devin: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden fill="none">
      <path d="M12 2 4 6.5v5l8 4.5 8-4.5v-5L12 2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M4 11.5 12 16l8-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 16v6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
}

const MCP_TOOL_MARKS: Record<string, EditorMarkName | 'other'> = {
  cursor: 'Cursor',
  claudeCode: 'Claude Code',
  windsurf: 'Windsurf',
  lovable: 'Lovable',
  bolt: 'Bolt',
  replit: 'Replit',
  codex: 'Codex',
  devin: 'Devin',
  other: 'other',
}

export function EditorMark({
  name,
  className = 'h-4 w-4 shrink-0 text-brand',
}: {
  name: EditorMarkName | 'other'
  className?: string
}) {
  if (name === 'other') {
    return <Terminal className={className} aria-hidden />
  }
  return <span className={className}>{SVG_MARKS[name]}</span>
}

export function McpToolMark({ toolKey, className }: { toolKey: string; className?: string }) {
  const mark = MCP_TOOL_MARKS[toolKey] ?? 'other'
  return <EditorMark name={mark} className={className} />
}

export function getEditorMark(name: EditorMarkName): ReactNode {
  return SVG_MARKS[name]
}
