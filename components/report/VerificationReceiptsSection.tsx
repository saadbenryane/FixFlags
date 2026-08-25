import { ImprovementReceipt } from '@/components/product/ImprovementReceipt'
import { REPORT_COPY } from '@/lib/marketing/copy'
import type { ProductAttemptDTO } from '@/lib/products/workspace'
import { cn } from '@/lib/utils'

export function VerificationReceiptsSection({
  receipts,
  className,
}: {
  receipts: ProductAttemptDTO[]
  className?: string
}) {
  if (receipts.length === 0) return null

  const copy = REPORT_COPY.verificationReceipts

  return (
    <section
      id="verification-receipts"
      aria-labelledby="verification-receipts-heading"
      className={cn('space-y-4', className)}
    >
      <div className="space-y-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="verification-receipts-heading"
            className="text-lg font-semibold tracking-heading text-foreground"
          >
            {copy.title}
          </h2>
          <p className="text-xs font-medium text-muted-foreground">
            {copy.countLabel(receipts.length)}
          </p>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">{copy.body}</p>
      </div>
      <div className="grid gap-3">
        {receipts.map((receipt) => (
          <ImprovementReceipt key={receipt.id} attempt={receipt} />
        ))}
      </div>
    </section>
  )
}
