import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { EditorMark } from '@/components/brand/EditorMarks'
import {
  HOMEPAGE_EDITOR_INTEGRATIONS,
  editorDocsHref,
} from '@/lib/integrations/editor-catalog'
import { cn } from '@/lib/utils'

interface EditorIntegrationGridProps {
  className?: string
  variant?: 'homepage' | 'docs'
}

export function EditorIntegrationGrid({
  className,
  variant = 'homepage',
}: EditorIntegrationGridProps) {
  const isDocs = variant === 'docs'

  return (
    <ul
      className={cn(
        'grid grid-cols-2 items-center gap-x-5 gap-y-2 sm:gap-x-8 md:grid-cols-4',
        isDocs ? 'md:gap-x-6 md:gap-y-3' : 'lg:gap-x-12 lg:gap-y-4',
        className
      )}
      aria-label="FixFlags editor integration guides"
    >
      {HOMEPAGE_EDITOR_INTEGRATIONS.map((editor) => (
        <li key={editor.key}>
          <Link
            href={editorDocsHref(editor)}
            aria-label={`Open the ${editor.label} integration guide`}
            className={cn(
              'group inline-flex min-h-11 w-full items-center gap-2.5 rounded-[var(--radius-control)] py-2 text-sm font-semibold tracking-heading text-foreground/70 transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
              isDocs && 'px-2'
            )}
          >
            <EditorMark
              name={editor.label}
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center transition-colors duration-150 group-hover:text-brand"
            />
            <span className="min-w-0">{editor.label}</span>
            <ArrowUpRight
              className="ml-auto h-3.5 w-3.5 shrink-0 translate-y-0.5 text-muted-foreground/0 transition-[color,transform] duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand group-focus-visible:text-brand"
              aria-hidden
            />
          </Link>
        </li>
      ))}
    </ul>
  )
}

