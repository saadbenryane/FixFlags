import { AuditInput } from '@/components/audit/AuditInput'
import { Heading, Muted } from '@/components/ui/typography'

interface Props {
  headline: string
  trustLine: string
}

export function AuditCtaBlock({ headline, trustLine }: Props) {
  return (
    <div className="marketing-panel mx-auto flex max-w-3xl flex-col items-center px-6 py-10 text-center sm:px-10 sm:py-12">
      <Heading as="h2" className="max-w-lg">
        {headline}
      </Heading>
      <div className="mt-8 w-full max-w-xl">
        <AuditInput />
      </div>
      <Muted className="mt-3">{trustLine}</Muted>
    </div>
  )
}
