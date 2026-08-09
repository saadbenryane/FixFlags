import { SectionTitle } from '@/components/ui/typography'
import { REPORT_COPY } from '@/lib/marketing/copy'
import { pluralize } from '@/lib/utils/plural'

/**
 * Shared Fix list header ("All fixes") with the unresolved count. Projects the
 * same heading and count copy across completed, progressive, and sample reports.
 */
export function ReportFixListHeader({ count }: { count: number }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <SectionTitle>{REPORT_COPY.sectionTitles.allFixes}</SectionTitle>
      {count > 0 ? (
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {pluralize(count, 'fix', 'fixes')}
        </span>
      ) : null}
    </div>
  )
}
