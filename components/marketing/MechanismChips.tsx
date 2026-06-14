import { Camera, Bot, ClipboardCheck, Sparkles } from 'lucide-react'
import { HERO_MECHANISM_LINE } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

const ICONS = [Camera, ClipboardCheck, Bot, Sparkles] as const

interface Props {
  className?: string
  variant?: 'default' | 'subtle'
}

export function MechanismChips({ className, variant = 'default' }: Props) {
  const chips = HERO_MECHANISM_LINE.split(' · ')

  return (
    <ul className={cn('flex flex-wrap gap-2', className)} aria-label="Audit evidence">
      {chips.map((chip, i) => {
        const Icon = ICONS[i] ?? Sparkles
        return (
          <li
            key={chip}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-label',
              variant === 'subtle'
                ? 'bg-brand/10 text-brand/90'
                : 'bg-muted/50 text-muted-foreground'
            )}
          >
            <Icon className="h-4 w-4 shrink-0 stroke-[1.75]" aria-hidden />
            {chip}
          </li>
        )
      })}
    </ul>
  )
}
