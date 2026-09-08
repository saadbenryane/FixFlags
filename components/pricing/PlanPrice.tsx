import { cn } from '@/lib/utils'

function isCurrencyPrice(price: string): boolean {
  return /^\$?\d/.test(price.trim())
}

const SIZE_CLASS = {
  lg: 'text-4xl',
  md: 'text-2xl',
  sm: 'text-sm',
} as const

interface PlanPriceProps {
  price: string
  className?: string
  size?: keyof typeof SIZE_CLASS
}

/** Inter Tight plan price or waitlist status. Never JetBrains Mono. */
export function PlanPrice({ price, className, size = 'lg' }: PlanPriceProps) {
  return (
    <span
      className={cn(
        'font-display font-semibold tracking-display',
        isCurrencyPrice(price) && 'tabular-nums',
        SIZE_CLASS[size],
        className,
      )}
    >
      {price}
    </span>
  )
}
