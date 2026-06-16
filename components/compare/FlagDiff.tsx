import { cn, rubricLabel } from '@/lib/utils'
import { CheckCircle2 } from 'lucide-react'

interface FlagDiffItem {
  checkId: string | null
  problem: string
  rubric: string
  severity: string
  status?: string
}

interface Props {
  fixed: FlagDiffItem[]
  unchanged: FlagDiffItem[]
  regressed: FlagDiffItem[]
  newIssues: FlagDiffItem[]
}

export function FlagDiff({ fixed, unchanged, regressed, newIssues }: Props) {
  if (
    fixed.length === 0 &&
    unchanged.length === 0 &&
    regressed.length === 0 &&
    newIssues.length === 0
  ) {
    return null
  }

  return (
    <div className="space-y-4">
      {fixed.length > 0 && (
        <FixedSection items={fixed} />
      )}
      {regressed.length > 0 && (
        <DiffSection
          title="Regressed"
          items={regressed}
          className="text-destructive border-destructive/30"
        />
      )}
      {newIssues.length > 0 && (
        <DiffSection title="New flags" items={newIssues} className="text-brand border-brand/30" />
      )}
      {unchanged.length > 0 && (
        <DiffSection
          title="Still open"
          items={unchanged}
          className="text-muted-foreground border-border"
        />
      )}
    </div>
  )
}

function FixedSection({ items }: { items: FlagDiffItem[] }) {
  return (
    <div className="rounded-xl border border-success-border bg-grade-A/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-success shrink-0" aria-hidden />
        <span className="text-sm font-semibold text-success">
          {items.length === 1 ? '1 flag fixed' : `${items.length} flags fixed`}
        </span>
      </div>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li
            key={`${item.checkId ?? item.problem}-${i}`}
            className="flex items-start gap-2 text-sm"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" aria-hidden />
            <span>
              <span className="text-muted-foreground">{rubricLabel(item.rubric)} · </span>
              <span className="line-through text-muted-foreground">{item.problem}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function DiffSection({
  title,
  items,
  className,
}: {
  title: string
  items: FlagDiffItem[]
  className: string
}) {
  return (
    <div className={cn('rounded-xl border p-4 space-y-2', className)}>
      <div className="text-sm font-medium">
        {title} ({items.length})
      </div>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={`${item.checkId ?? item.problem}-${i}`} className="text-sm text-foreground">
            <span className="text-muted-foreground">{rubricLabel(item.rubric)} · </span>
            {item.problem}
          </li>
        ))}
      </ul>
    </div>
  )
}
