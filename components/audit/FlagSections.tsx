'use client'

import { FlagCard } from '@/components/audit/FlagCard'
import { Card } from '@/components/ui/card'
import { SectionTitle } from '@/components/ui/typography'
import {
  groupFlagsBySeverity,
  countFlags,
  type RankableFlag,
} from '@/lib/audit/priority-flags'
import type { AuditScreenshot } from '@/lib/audit/screenshot-types'
import type { EvidenceAnchorMap } from '@/lib/marketing/resolve-evidence-anchors'
import { severityLabel } from '@/lib/utils'

interface Props {
  flags: RankableFlag[]
  screenshots?: AuditScreenshot[]
  reportHost?: string
  evidenceAnchors?: EvidenceAnchorMap
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
  screenshots,
  reportHost,
  evidenceAnchors,
  showFeedback = true,
  defaultCollapsed = true,
}: Props) {
  const groups = groupFlagsBySeverity(flags)
  const counts = countFlags(flags)
  const expandCritical = counts.critical > 0

  if (counts.total === 0) return null

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <SectionTitle>
          {counts.total} Flag{counts.total !== 1 ? 's' : ''} found
        </SectionTitle>
        {counts.critical > 0 && (
          <span className="text-xs font-medium text-destructive">
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

        const sectionExpanded =
          key === 'critical' ? expandCritical : !defaultCollapsed

        return (
          <div key={key} className="space-y-2">
            <h3 className="font-mono text-xs uppercase tracking-label text-muted-foreground">
              {severityLabel(severity)} ({sectionFlags.length})
            </h3>
            <Card className="overflow-hidden p-0">
              {sectionFlags.map((flag, index) => (
                <FlagCard
                  key={flag.id}
                  flag={flag}
                  flagIndex={flags.indexOf(flag)}
                  screenshots={screenshots}
                  reportHost={reportHost}
                  evidenceAnchors={evidenceAnchors}
                  showFeedback={showFeedback}
                  variant="row"
                  defaultExpanded={sectionExpanded && (key !== 'critical' || index === 0)}
                />
              ))}
            </Card>
          </div>
        )
      })}
    </section>
  )
}
