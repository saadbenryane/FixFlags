'use client'

import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'

interface QueuePositionProps {
  estimatedSeconds: number
  onRetry: () => void
  onDismiss: () => void
}

export function QueuePosition({ estimatedSeconds, onRetry, onDismiss }: QueuePositionProps) {
  const [countdown, setCountdown] = useState(estimatedSeconds)

  useEffect(() => {
    if (countdown <= 0) {
      onRetry()
      return
    }
    const timer = setInterval(() => setCountdown((s) => s - 1), 1000)
    return () => clearInterval(timer)
  }, [countdown, onRetry])

  if (countdown <= 0) return null

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3" role="status">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/10">
          <Clock className="h-4 w-4 text-brand" />
        </div>
        <div>
          <p className="text-sm font-medium">You&rsquo;re queued</p>
          <p className="text-xs text-muted-foreground">
            Retrying in {countdown}s
          </p>
        </div>
      </div>
      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full bg-brand rounded-full transition-all duration-1000"
          style={{ width: `${((estimatedSeconds - countdown) / estimatedSeconds) * 100}%` }}
        />
      </div>
      <button
        onClick={onDismiss}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Cancel
      </button>
    </div>
  )
}
