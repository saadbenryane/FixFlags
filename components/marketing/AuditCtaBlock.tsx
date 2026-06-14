import { AuditInput } from '@/components/audit/AuditInput'
import { Heading, Muted } from '@/components/ui/typography'
import { cn } from '@/lib/utils'

interface Props {
  headline: string
  trustLine: string
  className?: string
}

export function AuditCtaBlock({ headline, trustLine, className }: Props) {
  return (
    <div
      className={cn(
        'mx-auto flex max-w-3xl flex-col items-center overflow-hidden rounded-card border-0 bg-card px-6 py-12 text-center shadow-card sm:px-12 sm:py-14',
        className
      )}
    >
      <Heading as="h2" className="max-w-lg">
        {headline}
      </Heading>
      <div className="mt-8 w-full max-w-xl rounded-nested-md bg-muted/20 p-1">
        <AuditInput />
      </div>
      <Muted className="mt-4">{trustLine}</Muted>
    </div>
  )
}
