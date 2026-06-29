import { Calendar, ChevronRight, Clock, TrendingDown, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

function timeAgo(date: Date): string {
  const now = Date.now()
  const diff = now - new Date(date).getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  if (weeks < 4) return `${weeks}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

interface TimelineEvent {
  id: string
  auditId: string
  url: string
  score: number
  verdict: string
  createdAt: Date
  status: 'COMPLETED' | 'IN_PROGRESS' | 'FAILED'
  flags: number
  criticalFlags: number
  importantFlags: number
  isComparison?: boolean
  comparisonId?: string
  lastRunAt?: Date
}

interface ReportTimelineProps {
  events: TimelineEvent[]
  currentAuditId?: string
  showComparisonLink?: boolean
  className?: string
}

export function ReportTimeline({
  events,
  currentAuditId,
  showComparisonLink = false,
  className,
}: ReportTimelineProps) {
  if (!events || events.length === 0) {
    return (
      <Card className="p-8 text-center">
        <div className="text-muted-foreground">
          <Calendar className="mx-auto h-12 w-12" />
          <h3 className="mt-4 text-lg font-semibold">No previous audits found</h3>
          <p className="mt-2 text-sm">Run your first audit to see your tracking history.</p>
        </div>
      </Card>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Audit History</h3>
          <p className="text-sm text-muted-foreground">
            Track your site&apos;s improvement over time ({events.length} audit{events.length !== 1 ? 's' : ''})
          </p>
        </div>
        {showComparisonLink && events.some(e => e.isComparison) && (
          <Link
            href={`/compare/${events.find(e => e.isComparison)?.comparisonId || ''}`}
            className="text-sm text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
          >
            View comparison
            <ChevronRight className="h-3 w-3" />
          </Link>
        )}
      </div>

      <div className="max-h-[600px] overflow-y-auto pr-4">
        <div className="space-y-3 pr-4">
          {events.map((event, index) => (
            <TimelineItem
              key={event.id}
              event={event}
              isLatest={event.id === currentAuditId}
              showDivider={index < events.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

interface TimelineItemProps {
  event: TimelineEvent
  isLatest: boolean
  showDivider: boolean
}

function TimelineItem({ event, isLatest, showDivider }: TimelineItemProps) {
  const isCompleted = event.status === 'COMPLETED'
  const scoreGrade = getScoreGrade(event.score)
  const relativeTime = timeAgo(event.createdAt)

  return (
    <div className="relative">
      {showDivider && (
        <div className="absolute left-6 top-12 h-full w-0.5 bg-border" />
      )}

      <div className="relative flex items-start gap-4">
        <div className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 bg-background",
          isLatest
            ? "border-blue-500 bg-blue-50"
            : isCompleted
              ? "border-green-500 bg-green-50"
              : "border-gray-300 bg-gray-50"
        )}
        >
          {isLatest ? (
            <div className="h-2 w-2 rounded-full bg-blue-500" />
          ) : isCompleted ? (
            <div className="h-2 w-2 rounded-full bg-green-500" />
          ) : (
            <div className="h-2 w-2 rounded-full bg-gray-400" />
          )}
        </div>

        <Card
          className={cn(
            "flex-1 transition-all hover:shadow-md",
            isLatest && "border-blue-200 bg-blue-50/50"
          )}
        >
          <Link href={`/report/${event.auditId}`} className="block">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="font-medium truncate max-w-[200px]">
                    {event.url.replace(/^https?:\/\//, '')}
                  </div>
                  {event.isComparison && (
                    <Badge variant="outline" className="text-xs">
                      Comparison
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {event.lastRunAt && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {timeAgo(event.lastRunAt)}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4 mt-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Score</div>
                  <div className={cn("text-lg font-bold", scoreGrade.color)}>
                    {event.score != null ? event.score : '–'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Total Flags</div>
                  <div className="text-sm font-medium">{event.flags}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Critical</div>
                  <div className={cn(
                    "text-sm font-medium",
                    event.criticalFlags > 0 ? "text-red-600" : "text-green-600"
                  )}>
                    {event.criticalFlags}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Important</div>
                  <div className={cn(
                    "text-sm font-medium",
                    event.importantFlags > 0 ? "text-orange-600" : "text-green-600"
                  )}>
                    {event.importantFlags}
                  </div>
                </div>
              </div>

              {event.verdict && isCompleted && (
                <div className="mt-3">
                  <div className="text-xs text-muted-foreground mb-1">Status</div>
                  <div className="flex items-center gap-2">
                    {event.verdict.includes('FIXED') || event.verdict.includes('good') ? (
                      <TrendingUp className="h-3 w-3 text-green-600" />
                    ) : event.verdict.includes('REGRESSED') ? (
                      <TrendingDown className="h-3 w-3 text-red-600" />
                    ) : (
                      <Clock className="h-3 w-3 text-blue-600" />
                    )}
                    <span className={cn("text-xs", statusColor(event.verdict))}>
                      {event.verdict}
                    </span>
                  </div>
                </div>
              )}

              {event.status === 'COMPLETED' && (
                <div className="mt-3 pt-3 border-t border-border">
                  {relativeTime}
                </div>
              )}
            </CardContent>
          </Link>
        </Card>
      </div>
    </div>
  )
}

function getScoreGrade(score: number | null): { color: string; text: string } {
  if (score == null) return { color: "text-gray-500", text: "–" }
  if (score >= 90) return { color: "text-green-600", text: "A" }
  if (score >= 75) return { color: "text-green-600", text: "B" }
  if (score >= 60) return { color: "text-yellow-600", text: "C" }
  if (score >= 40) return { color: "text-orange-600", text: "D" }
  return { color: "text-red-600", text: "F" }
}

function statusColor(verdict: string): string {
  if (verdict.includes('FIXED') || verdict.includes('good')) return "text-green-600"
  if (verdict.includes('REGRESSED')) return "text-red-600"
  if (verdict.includes('BLOCKED')) return "text-red-600"
  return "text-blue-600"
}