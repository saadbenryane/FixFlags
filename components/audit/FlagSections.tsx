'use client'

import { FlagCard } from '@/components/audit/FlagCard'
import {
  groupFlagsBySeverity,
  countFlags,
  type RankableFlag,
} from '@/lib/audit/priority-flags'
import { severityLabel } from '@/lib/utils'

interface Props {
  flags: RankableFlag[]
  showFeedback?: boolean
  defaultCollapsed?: boolean
}

const SEVERITY_SECTIONS = [
  { key: 'critical' as const, severity: 'CRITICAL' as const },
  { key: 'important' as const, severity: 'IMPORTANT' as const },
  { key: 'polish' as const, severity: 'POLISH' as const },
]

export function FlagSections({
  flags,
  showFeedback = true,
  defaultCollapsed = true,
}: Props) {
  const groups = groupFlagsBySeverity(flags)
  const counts = countFlags(flags)

  if (counts.total === 0) return null

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <h2 className="text-sm font-semibold tracking-heading">
          {counts.total} Flag{counts.total !== 1 ? 's' : ''} found
        </h2>
        {counts.critical > 0 && (
          <span className="text-xs text-destructive font-medium">
            {counts.critical} critical
            {counts.important > 0 && ` · ${counts.important} important`}
          </span>
        )}
        {counts.critical === 0 && counts.important > 0 && (
          <span className="text-xs text-muted-foreground">
            {counts.important} important
            {counts.polish > 0 && ` · ${counts.polish} polish`}
          </span>
        )}
      </div>

      {SEVERITY_SECTIONS.map(({ key, severity }) => {
        const sectionFlags = groups[key]
        if (sectionFlags.length === 0) return null

        return (
          <div key={key} className="space-y-2">
            <h3 className="text-xs font-mono uppercase tracking-label text-muted-foreground">
              {severityLabel(severity)} ({sectionFlags.length})
            </h3>
            <div className="overflow-hidden rounded-card border-0 bg-card shadow-card">
              {sectionFlags.map((flag) => (
                <FlagCard
                  key={flag.id}
                  flag={flag}
                  showFeedback={showFeedback}
                  variant="row"
                  defaultExpanded={!defaultCollapsed}
                />
              ))}
            </div>
          </div>
        )
      })}
    </section>
  )
}
