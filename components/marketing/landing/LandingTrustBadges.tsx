import { Check } from 'lucide-react'
import { HERO } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

export function LandingTrustBadges({ className }: { className?: string }) {
  return (
    <ul className={cn('flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-8 sm:gap-y-2', className)}>
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
