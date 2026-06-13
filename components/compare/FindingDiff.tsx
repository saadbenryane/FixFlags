'use client'
import { cn } from '@/lib/utils'

interface FindingDiffItem {
  checkId: string | null
  problem: string
  area: string
  severity: string
  status?: string
}

interface Props {
  fixed: FindingDiffItem[]
  regressed: FindingDiffItem[]
  newIssues: FindingDiffItem[]
}

export function FindingDiff({ fixed, regressed, newIssues }: Props) {
  if (fixed.length === 0 && regressed.length === 0 && newIssues.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold">Finding changes</h2>

      {fixed.length > 0 && (
        <DiffSection title="Fixed" items={fixed} className="text-green-600 border-green-200" />
      )}
      {regressed.length > 0 && (
        <DiffSection title="Regressed" items={regressed} className="text-destructive border-destructive/30" />
      )}
      {newIssues.length > 0 && (
        <DiffSection title="New issues" items={newIssues} className="text-amber-600 border-amber-200" />
      )}
    </div>
  )
}

function DiffSection({
  title,
  items,
  className,
}: {
  title: string
  items: FindingDiffItem[]
  className: string
}) {
  return (
    <div className={cn('rounded-xl border p-4 space-y-2', className)}>
      <div className="text-sm font-medium">{title} ({items.length})</div>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={`${item.checkId ?? item.problem}-${i}`} className="text-sm text-foreground">
            <span className="text-muted-foreground">{item.area} · </span>
            {item.problem}
          </li>
        ))}
      </ul>
    </div>
  )
}
