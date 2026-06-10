'use client'
import { CheckCircle2, Circle, Loader2 } from 'lucide-react'

const STAGES = [
  { status: 'CAPTURING', label: 'Taking screenshots...' },
  { status: 'CHECKING', label: 'Running 60 quality checks...' },
  { status: 'JUDGING', label: 'AI is analyzing your page...' },
  { status: 'COMPLETED', label: 'Report ready' },
]

function stageIndex(status: string): number {
  return STAGES.findIndex((s) => s.status === status)
}

export function AuditProgress({
  status,
  desktopScreenshotUrl,
}: {
  status: string
  desktopScreenshotUrl?: string | null
}) {
  const currentIdx = stageIndex(status)

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="space-y-3">
        {STAGES.slice(0, 3).map((stage, idx) => {
          const done = currentIdx > idx || status === 'COMPLETED'
          const active = currentIdx === idx && status !== 'COMPLETED' && status !== 'FAILED'

          return (
            <div key={stage.status} className="flex items-center gap-3">
              {done ? (
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
              ) : active ? (
                <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
              )}
              <span
                className={
                  done
                    ? 'text-sm text-green-600 line-through'
                    : active
                    ? 'text-sm font-medium'
                    : 'text-sm text-muted-foreground'
                }
              >
                {stage.label}
              </span>
            </div>
          )
        })}
      </div>

      {desktopScreenshotUrl && (
        <div className="animate-fade-in rounded-lg overflow-hidden border shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={desktopScreenshotUrl}
            alt="Desktop screenshot"
            className="w-full object-cover"
          />
        </div>
      )}
    </div>
  )
}
