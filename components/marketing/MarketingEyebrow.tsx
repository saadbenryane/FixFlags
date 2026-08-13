import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface MarketingEyebrowProps {
  children: ReactNode
  className?: string
  /** Brand orange dot before the label (homepage marketing). Default true. */
  dot?: boolean
}

/** Mono uppercase marketing eyebrow with the brand dot, colored by .marketing-eyebrow. */
export function MarketingEyebrow({ children, className, dot = true }: MarketingEyebrowProps) {
  return (
    <p className={cn('marketing-eyebrow inline-flex items-center gap-2', className)}>
      {dot ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden /> : null}
      {children}
    </p>
  )
}
