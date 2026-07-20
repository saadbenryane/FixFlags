import type { ProductContract } from '@/lib/audit/product-contract'

interface ProductContractCardProps {
  contract: ProductContract
  className?: string
}

export function ProductContractCard({ contract, className }: ProductContractCardProps) {
  return (
    <section
      id="report-contract"
      className={`rounded-card bg-card/60 px-5 py-4 shadow-card glass-surface ${className ?? ''}`}
      aria-labelledby="product-contract-heading"
    >
      <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Product contract
      </p>
      <h2 id="product-contract-heading" className="mt-1 font-display text-lg text-foreground">
        What this product appears to do
      </h2>
      <p className="mt-2 text-sm text-foreground/90">{contract.purpose}</p>
      <p className="mt-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">First-value journey:</span>{' '}
        {contract.firstValueJourney}
      </p>
      {contract.criticalOutcomes.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {contract.criticalOutcomes.map((outcome) => (
            <li key={outcome}>{outcome}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
