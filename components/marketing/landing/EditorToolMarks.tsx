import type { ReactNode } from 'react'
import { getEditorMark, type EditorMarkName } from '@/components/brand/EditorMarks'
import { LANDING_PAGE } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

type ToolLogoName = (typeof LANDING_PAGE.logoCloud.logos)[number]

const LOGO_MARKS: Record<ToolLogoName, ReactNode> = Object.fromEntries(
  LANDING_PAGE.logoCloud.logos.map((name) => [name, getEditorMark(name as EditorMarkName)])
) as Record<ToolLogoName, ReactNode>

interface EditorToolMarksProps {
  className?: string
  compact?: boolean
}

export function EditorToolMarks({ className, compact = false }: EditorToolMarksProps) {
  const { label, logos, disclaimer } = LANDING_PAGE.logoCloud

  return (
    <div className={cn('space-y-3', className)}>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <ul
        className={cn(
          'flex flex-wrap items-center gap-x-6 gap-y-3',
          compact ? 'gap-x-5 gap-y-2.5' : 'sm:gap-x-8'
        )}
      >
        {logos.map((name) => (
          <li
            key={name}
            className={cn(
              'flex items-center gap-2 font-semibold tracking-tight text-foreground/65 [&_svg]:h-5 [&_svg]:w-5',
              compact ? 'text-sm' : 'text-[15px]'
            )}
          >
            {LOGO_MARKS[name]}
            {name}
          </li>
        ))}
      </ul>
      {disclaimer ? (
        <p className="text-2xs text-muted-foreground/70">{disclaimer}</p>
      ) : null}
    </div>
  )
}
