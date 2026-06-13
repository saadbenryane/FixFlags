import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Props {
  pageJob: string
  pageType: string
  verdict: string
  score: number
  url: string
}

function scoreTone(score: number): string {
  if (score >= 80) return 'text-grade-A bg-grade-A/10 border-grade-A/25'
  if (score >= 60) return 'text-grade-C bg-grade-C/10 border-grade-C/25'
  if (score >= 40) return 'text-grade-D bg-grade-D/10 border-grade-D/25'
  return 'text-grade-F bg-grade-F/10 border-grade-F/25'
}

export function AuditVerdict({ pageJob, pageType, verdict, score, url }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        <div className={cn('rounded-xl border p-4 text-center min-w-[80px]', scoreTone(score))}>
          <div className="text-3xl font-bold tabular-nums">{score}</div>
          <div className="text-xs text-muted-foreground mt-1">/ 100</div>
        </div>
        <div className="flex-1 space-y-2 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs capitalize">
              {pageType}
            </Badge>
            <span className="text-sm font-medium text-muted-foreground">Page job:</span>
            <span className="text-sm font-medium">{pageJob}</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed text-pretty">{verdict}</p>
          <p className="text-xs text-muted-foreground truncate">{url}</p>
        </div>
      </div>
    </div>
  )
}
