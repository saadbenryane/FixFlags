import { Check } from 'lucide-react'
import { HERO } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

export function HeroBenefits({ className }: { className?: string }) {
  return (
    <ul className={cn('space-y-2', className)}>
      {HERO.benefits.map((benefit) => (
        <li key={benefit} className="flex items-start gap-2.5 text-sm text-muted-foreground">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
          <span className="text-pretty">{benefit}</span>
        </li>
      ))}
    </ul>
  )
}
