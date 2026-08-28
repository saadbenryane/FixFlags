import { CheckCircle2, HelpCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Callout } from '@/components/ui/callout'
import { cn, rubricLabel } from '@/lib/utils'
import { RECHECK_DIFF_COPY } from '@/lib/marketing/copy'

interface FlagDiffItem {
  checkId: string | null
  problem: string
  rubric: string
  severity: string
  status?: string
  pageUrl?: string | null
  foundOnNewPage?: boolean
}

interface Props {
  fixed: FlagDiffItem[]
  unchanged: FlagDiffItem[]
  regressed: FlagDiffItem[]
  newIssues: FlagDiffItem[]
  inconclusive?: FlagDiffItem[]
  childPartial?: boolean
}

export function FlagDiff({
  fixed,
  unchanged,
  regressed,
  newIssues,
  inconclusive = [],
  childPartial = false,
}: Props) {
  const total =
    fixed.length +
    unchanged.length +
    regressed.length +
    newIssues.length +
    inconclusive.length
  if (total === 0) {
    return (
      <Callout variant="neutral" title={RECHECK_DIFF_COPY.empty}>
        {RECHECK_DIFF_COPY.outcomesHint}
      </Callout>
    )
  }

  return (
    <div className="space-y-4">
      {fixed.length > 0 && <FixedSection items={fixed} />}
      {inconclusive.length > 0 && (
        <Callout
          variant="warning"
          title={`${inconclusive.length} inconclusive`}
        >
          <p className="mb-3 text-sm">
            {childPartial
              ? RECHECK_DIFF_COPY.inconclusiveBodyPartial(inconclusive.length)
              : RECHECK_DIFF_COPY.inconclusiveBodyGeneric(inconclusive.length)}
          </p>
          <ul className="space-y-2">
            {inconclusive.map((item, i) => (
              <li
                key={`${item.checkId ?? item.problem}-inc-${i}`}
                className="flex items-start gap-2 text-sm"
              >
                <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
                <span>
                  <span className="text-muted-foreground">{rubricLabel(item.rubric)} · </span>
                  {item.problem}
                </span>
              </li>
            ))}
          </ul>
        </Callout>
      )}
      {regressed.length > 0 && (
        <DiffSection title="Regressed" items={regressed} variant="danger" />
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
    <Card className="border-0 p-4 shadow-card">
      <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li
            key={`${item.checkId ?? item.problem}-${i}`}
            className={cn(
              'text-sm',
              variant === 'danger' && 'text-destructive',
              variant === 'info' && 'text-foreground',
              variant === 'neutral' && 'text-muted-foreground'
            )}
          >
            <span className="text-muted-foreground">{rubricLabel(item.rubric)} · </span>
            {item.problem}
            {item.foundOnNewPage ? (
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {RECHECK_DIFF_COPY.foundOnNewPage}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  )
}
