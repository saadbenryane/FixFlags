import { Lock, ShieldCheck, Zap } from 'lucide-react'
import { HERO } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

const ASSURANCE_ICONS = {
  shield: ShieldCheck,
  lock: Lock,
  zap: Zap,
} as const

interface AssuranceRowProps {
  className?: string
}

/** Shared hero / final-CTA assurance chips. Copy from HERO.assurances only. */
export function AssuranceRow({ className }: AssuranceRowProps) {
  return (
    <ul
      className={cn(
        'flex flex-col gap-2 sm:flex-row sm:flex-nowrap sm:items-center sm:gap-0',
        className
      )}
    >
      {HERO.assurances.map((item, index) => {
        const Icon = ASSURANCE_ICONS[item.icon]
        return (
          <li
            key={item.id}
            className="inline-flex items-center gap-2 whitespace-nowrap text-[0.8125rem] text-foreground/80 sm:gap-2 lg:text-[0.6875rem]"
          >
            {index > 0 ? (
              <span
                aria-hidden
                className="mx-2 hidden h-4 w-px shrink-0 bg-border/80 sm:mx-2.5 sm:inline-block"
              />
            ) : null}
            <Icon
              className="h-4 w-4 shrink-0 self-center text-foreground/65 lg:h-3.5 lg:w-3.5"
              strokeWidth={1.75}
              aria-hidden
            />
            <span className="leading-none">{item.label}</span>
          </li>
        )
      })}
    </ul>
  )
}
