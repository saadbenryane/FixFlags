import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SeverityBadge } from '@/components/audit/SeverityBadge'
import { TextLink } from '@/components/ui/text-link'
import { rubricLabel } from '@/lib/utils'

interface FeedbackItem {
  key: string
  problem: string
  checkId: string | null
  rubric: string
  severity: string
  evidence: string
  sampleAuditId: string
  count: number
}

export function FeedbackList({ items }: { items: FeedbackItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No downvoted flags yet.</p>
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <Card key={item.key} variant="solid" className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <SeverityBadge severity={item.severity} />
              <Badge variant="outline" className="text-xs">{rubricLabel(item.rubric)}</Badge>
              {item.checkId && (
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{item.checkId}</code>
              )}
            </div>
            <div className="text-sm font-bold text-destructive shrink-0">
              👎 {item.count}
            </div>
          </div>
          <div className="text-sm font-medium">{item.problem}</div>
          <div className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
            {item.evidence}
          </div>
          <TextLink href={`/admin/audits/${item.sampleAuditId}`} className="text-xs">
            View source audit &rarr;
          </TextLink>
        </Card>
      ))}
    </div>
  )
}
