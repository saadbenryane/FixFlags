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
  showDisclaimer?: boolean
  compact?: boolean
}

export function EditorToolMarks({
  className,
  showDisclaimer = true,
  compact = false,
}: EditorToolMarksProps) {
  const { label, logos, disclaimer } = LANDING_PAGE.logoCloud

  return (
    <div className={cn('space-y-3', className)}>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <ul
        className={cn(
          'flex flex-wrap items-center gap-x-5 gap-y-3',
          compact ? 'gap-x-4 gap-y-2' : 'sm:gap-x-7'
        )}
      >
        {logos.map((name) => (
          <li
            key={name}
            className={cn(
              'flex items-center gap-1.5 font-semibold tracking-tight text-foreground/60',
              compact ? 'text-xs' : 'text-sm'
            )}
          >
            {LOGO_MARKS[name]}
            {name}
          </li>
        ))}
      </ul>
      {showDisclaimer ? (
        <p className="max-w-xl text-xs text-muted-foreground/60">{disclaimer}</p>
      ) : null}
    </div>
  )
}
