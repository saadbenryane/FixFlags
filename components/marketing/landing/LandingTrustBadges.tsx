import { Check } from 'lucide-react'
import { HERO } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

export function LandingTrustBadges({ className }: { className?: string }) {
  if (HERO.trustBadges.length === 0) return null

  return (
    <div className={cn('text-center', className)}>
      <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 sm:gap-x-8">
        {HERO.trustBadges.map((item) => (
          <li key={item} className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Check className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
