import { customerBindingResult } from '@/lib/sites/outcome-state'

export function OutcomeBindingResult({
  bindingKey,
  disposition,
  reason,
}: {
  bindingKey: string
  disposition: string
  reason: string
}) {
  const result = customerBindingResult({ key: bindingKey, disposition, reason })
  return (
    <>
      <p className="mt-3 text-sm font-medium">{result.headline}</p>
      {result.detail ? <p className="mt-1 text-sm text-muted-foreground">{result.detail}</p> : null}
    </>
  )
}
