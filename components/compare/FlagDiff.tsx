import { CheckCircle2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Callout } from '@/components/ui/callout'
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
      {fixed.length > 0 && <FixedSection items={fixed} />}
      {regressed.length > 0 && (
        <DiffSection
          title="Regressed"
          items={regressed}
          variant="danger"
        />
      )}
      {newIssues.length > 0 && (
        <DiffSection title="New flags" items={newIssues} variant="info" />
      )}
      {unchanged.length > 0 && (
        <DiffSection title="Still open" items={unchanged} variant="neutral" />
      )}
    </div>
  )
}

function FixedSection({ items }: { items: FlagDiffItem[] }) {
  return (
    <Callout variant="success" title={items.length === 1 ? '1 flag fixed' : `${items.length} flags fixed`}>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li
            key={`${item.checkId ?? item.problem}-${i}`}
            className="flex items-start gap-2 text-sm"
          >
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
            <span>
              <span className="text-muted-foreground">{rubricLabel(item.rubric)} · </span>
              <span className="line-through text-muted-foreground">{item.problem}</span>
            </span>
          </li>
        ))}
      </ul>
    </Callout>
  )
}

function DiffSection({
  title,
  items,
  variant,
}: {
  title: string
  items: FlagDiffItem[]
  variant: 'danger' | 'info' | 'neutral'
}) {
  return (
    <Card
      className={cn(
        'border-0 p-4 shadow-card space-y-2',
        variant === 'danger' && 'bg-destructive/5',
        variant === 'info' && 'bg-brand/5',
        variant === 'neutral' && 'bg-muted/30'
      )}
    >
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
    </Card>
  )
}
