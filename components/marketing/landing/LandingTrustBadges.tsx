import { Check } from 'lucide-react'
import { HERO } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

export function LandingTrustBadges({ className }: { className?: string }) {
  return (
    <ul
      className={cn(
        'flex flex-wrap items-center justify-center gap-x-6 gap-y-2 sm:gap-x-8',
        className
      )}
    >
      {HERO.trustBadges.map((item) => (
        <li key={item} className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
            <Check className="h-3 w-3" aria-hidden />
          </span>
          {item}
        </li>
      ))}
    </ul>
  )
}
