import { Body, Heading } from '@/components/ui/typography'
import { cn } from '@/lib/utils'

interface Props {
  label?: string
  headline: string
  subhead?: string
  className?: string
}

export function SectionIntro({ label, headline, subhead, className }: Props) {
  return (
    <div className={cn('mx-auto max-w-2xl space-y-3 text-center', className)}>
      {label ? <p className="section-label">{label}</p> : null}
      <Heading as="h2">{headline}</Heading>
      {subhead ? <Body className="text-muted-foreground">{subhead}</Body> : null}
    </div>
  )
}
