import { Badge } from '@/components/ui/badge'

interface Props {
  pageJob: string
  pageType: string
  verdict: string
  score: number
  url: string
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-yellow-600'
  if (score >= 40) return 'text-orange-600'
  return 'text-red-600'
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-green-50 border-green-200'
  if (score >= 60) return 'bg-yellow-50 border-yellow-200'
  if (score >= 40) return 'bg-orange-50 border-orange-200'
  return 'bg-red-50 border-red-200'
}

export function AuditVerdict({ pageJob, pageType, verdict, score, url }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        <div className={`rounded-xl border-2 p-4 text-center min-w-[80px] ${scoreBg(score)}`}>
          <div className={`text-3xl font-bold ${scoreColor(score)}`}>{score}</div>
          <div className="text-xs text-muted-foreground mt-1">/ 100</div>
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs capitalize">
              {pageType}
            </Badge>
            <span className="text-sm font-medium text-muted-foreground">Page job:</span>
            <span className="text-sm font-medium">{pageJob}</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{verdict}</p>
          <p className="text-xs text-muted-foreground truncate">{url}</p>
        </div>
      </div>
    </div>
  )
}
