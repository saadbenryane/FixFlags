import { Heading } from '@/components/ui/typography'
import { cn } from '@/lib/utils'

interface Props {
  label?: string
  headline: string
  className?: string
}

export function SectionIntro({ label, headline, className }: Props) {
  return (
    <div className={cn('mx-auto max-w-xl space-y-3 text-center', className)}>
      {label ? <p className="section-label">{label}</p> : null}
      <Heading as="h2">{headline}</Heading>
    </div>
  )
}
