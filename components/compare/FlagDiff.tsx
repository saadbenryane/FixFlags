import { cn, rubricLabel } from '@/lib/utils'

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
      <h2 className="text-sm font-semibold">Flag changes</h2>

      {fixed.length > 0 && (
        <DiffSection title="Fixed" items={fixed} className="text-green-600 border-green-200" />
      )}
      {unchanged.length > 0 && (
        <DiffSection
          title="Unchanged"
          items={unchanged}
          className="text-muted-foreground border-border"
        />
      )}
      {regressed.length > 0 && (
        <DiffSection
          title="Regressed"
          items={regressed}
          className="text-destructive border-destructive/30"
        />
      )}
      {newIssues.length > 0 && (
        <DiffSection title="New Flags" items={newIssues} className="text-brand border-brand/30" />
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
