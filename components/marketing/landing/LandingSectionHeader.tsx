import { MarketingEyebrow } from '@/components/marketing/MarketingEyebrow'
import { Heading } from '@/components/ui/typography'
import { cn } from '@/lib/utils'

type HeaderSize = 'sm' | 'md' | 'lg'

interface LandingSectionHeaderProps {
  label?: string
  /** Full headline text without trailing period when accentPeriod is true. */
  headline: string
  subhead?: string
  className?: string
  align?: 'center' | 'left'
  showLabel?: boolean
  /** Brand orange-dot mono eyebrow (homepage marketing). Default false keeps blog/faq section-label. */
  brandEyebrow?: boolean
  /** Render a brand-colored period after the headline. */
  accentPeriod?: boolean
  /** Use "h1" when this header is the page's top-level heading (e.g. /faq). */
  as?: 'h1' | 'h2'
  /** Headline size: sm (sub-sections), md (default landing sections), lg (page titles). */
  size?: HeaderSize
}

const sizeClasses: Record<HeaderSize, string> = {
  sm: 'text-[1.75rem] sm:text-[2rem]',
  md: 'text-2xl font-semibold leading-display tracking-display sm:text-[1.75rem] md:text-[2rem]',
  lg: 'text-2xl font-semibold leading-display tracking-display sm:text-[2rem] md:text-[2.5rem]',
}

export function LandingSectionHeader({
  label,
  headline,
  subhead,
  className,
  align = 'center',
  showLabel = Boolean(label),
  brandEyebrow = false,
  accentPeriod = false,
  as = 'h2',
  size = 'md',
}: LandingSectionHeaderProps) {
  return (
    <div
      className={cn(
        'space-y-3',
        align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-prose text-left',
        className
      )}
    >
      {showLabel && label ? (
        brandEyebrow ? (
          <MarketingEyebrow className={align === 'center' ? 'justify-center' : undefined}>
            {label}
          </MarketingEyebrow>
        ) : (
          <p className="section-label">{label}</p>
        )
      ) : null}
      <Heading
        as={as}
        className={cn('font-display', as === 'h2' && sizeClasses[size])}
      >
        {headline}
        {accentPeriod ? (
          <span className="text-brand" aria-hidden>
            .
          </span>
        ) : null}
      </Heading>
      {subhead ? (
        <p
          className={cn(
            'text-base leading-relaxed text-muted-foreground text-pretty sm:text-[1.0625rem] sm:leading-relaxed',
            align === 'center' && 'mx-auto max-w-2xl'
          )}
        >
          {subhead}
        </p>
      ) : null}
    </div>
  )
}
