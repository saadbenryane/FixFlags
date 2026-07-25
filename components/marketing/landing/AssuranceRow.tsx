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
        'flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-0',
        className
      )}
    >
      {HERO.assurances.map((item, index) => {
        const Icon = ASSURANCE_ICONS[item.icon]
        return (
          <li
            key={item.id}
            className="inline-flex items-center gap-2 text-[0.8125rem] text-muted-foreground sm:text-sm"
          >
            {index > 0 ? (
              <span
                aria-hidden
                className="mx-3 hidden h-3.5 w-px shrink-0 bg-border sm:inline-block"
              />
            ) : null}
            <Icon
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80"
              strokeWidth={1.75}
              aria-hidden
            />
            <span>{item.label}</span>
          </li>
        )
      })}
    </ul>
  )
}
