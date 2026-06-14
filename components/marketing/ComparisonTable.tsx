import { Check, Minus } from 'lucide-react'
import { BRAND } from '@/lib/marketing/copy'

function ComparisonCell({ value }: { value: string }) {
  if (value === 'Yes') {
    return (
      <span className="inline-flex items-center justify-center gap-1 text-foreground">
        <Check className="h-4 w-4 text-brand" aria-hidden />
        <span className="sr-only">Yes</span>
      </span>
    )
  }
  if (value === 'No') {
    return (
      <span className="inline-flex items-center justify-center text-muted-foreground/50">
        <Minus className="h-4 w-4" aria-hidden />
        <span className="sr-only">No</span>
      </span>
    )
  }
  return <span className="text-sm text-muted-foreground">{value}</span>
}

export interface ComparisonRow {
  feature: string
  lighthouse: string
  manual: string
  qualityos: string
}

interface Props {
  rows: readonly ComparisonRow[]
}

export function ComparisonTable({ rows }: Props) {
  return (
    <div className="overflow-x-auto rounded-card bg-card shadow-card">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border/20">
            <th className="p-4 text-left font-medium" scope="col" />
            <th className="p-4 text-center font-medium text-muted-foreground" scope="col">
              Lighthouse
            </th>
            <th className="p-4 text-center font-medium text-muted-foreground" scope="col">
              Manual QA
            </th>
            <th className="p-4 text-center font-semibold text-foreground" scope="col">
              {BRAND.name}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.feature} className="border-t border-border/20">
              <td className="p-4 font-medium">{row.feature}</td>
              <td className="p-4 text-center">
                <ComparisonCell value={row.lighthouse} />
              </td>
              <td className="p-4 text-center">
                <ComparisonCell value={row.manual} />
              </td>
              <td className="p-4 text-center font-medium">
                <ComparisonCell value={row.qualityos} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
