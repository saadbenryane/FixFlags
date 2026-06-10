'use client'
import { Badge } from '@/components/ui/badge'
import { cn, severityColor, areaLabel } from '@/lib/utils'

interface FeedbackItem {
  key: string
  problem: string
  checkId: string | null
  area: string
  severity: string
  evidence: string
  count: number
}

export function FeedbackList({ items }: { items: FeedbackItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No downvoted findings yet.</p>
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.key} className="rounded-lg border bg-card p-4 space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={cn('text-xs', severityColor(item.severity))}>{item.severity}</Badge>
              <Badge variant="outline" className="text-xs">{areaLabel(item.area)}</Badge>
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
        </div>
      ))}
    </div>
  )
}
