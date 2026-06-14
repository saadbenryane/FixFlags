import { Body, Heading } from '@/components/ui/typography'
import { cn } from '@/lib/utils'

interface Props {
  label?: string
  headline: string
  subhead?: string
  className?: string
  align?: 'center' | 'left'
}

export function SectionIntro({ label, headline, subhead, className, align = 'center' }: Props) {
  const isLeft = align === 'left'

  return (
    <div
      className={cn(
        'space-y-3',
        isLeft ? 'max-w-lg text-left' : 'mx-auto max-w-2xl text-center',
        className
      )}
    >
      {label ? <p className="section-label">{label}</p> : null}
      <Heading as="h2">{headline}</Heading>
      {subhead ? (
        <Body className={cn('text-muted-foreground', isLeft && 'max-w-md')}>{subhead}</Body>
      ) : null}
    </div>
  )
}
