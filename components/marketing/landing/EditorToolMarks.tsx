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
  /**
   * Homepage hero logo strip: mono label, equal marks, nowrap at lg+.
   * Prefer this over long Tailwind override soup on the call site.
   */
  variant?: 'default' | 'hero'
  /** When false, hide the logoCloud label (section header already names the tools). */
  showLabel?: boolean
  /** Use compact display names when marks sit inside a tight integration grid. */
  shortLabels?: boolean
}

export function EditorToolMarks({
  className,
  compact = false,
  variant = 'default',
  showLabel = true,
  shortLabels = false,
}: EditorToolMarksProps) {
  const { label, logos, disclaimer } = LANDING_PAGE.logoCloud
  const isHero = variant === 'hero'

  return (
    <div
      className={cn(
        isHero ? 'space-y-2.5' : 'space-y-3',
        className
      )}
    >
      {showLabel ? (
        <p
          className={cn(
            isHero
              ? 'font-mono text-[0.625rem] font-medium uppercase tracking-[0.16em] text-muted-foreground/85'
              : 'text-sm font-medium text-muted-foreground'
          )}
        >
          {label}
        </p>
      ) : null}
      <ul
        className={cn(
          'flex flex-wrap items-center',
          isHero
            ? 'justify-start gap-x-4 gap-y-2 lg:flex-nowrap'
            : compact
              ? 'gap-x-5 gap-y-2.5'
              : 'gap-x-6 gap-y-3 sm:gap-x-8'
        )}
      >
        {logos.map((name) => (
          <li
            key={name}
            className={cn(
              'flex items-center gap-1.5 font-semibold tracking-heading',
              isHero
                ? 'text-[0.75rem] tracking-normal text-foreground/75 [&_svg]:h-5 [&_svg]:w-5 [&_svg]:opacity-95'
                : 'gap-2 text-sm text-foreground/65 [&_svg]:h-5 [&_svg]:w-5'
            )}
          >
            {LOGO_MARKS[name]}
            {shortLabels && name === 'Claude Code' ? 'Claude' : name}
          </li>
        ))}
      </ul>
      {disclaimer ? (
        <p className="text-2xs text-muted-foreground/70">{disclaimer}</p>
      ) : null}
    </div>
  )
}
