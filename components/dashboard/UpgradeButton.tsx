'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { parseApiErrorResponse } from '@/lib/api/parse-error'
import { getUpgradeMomentContent, type UpgradeMoment } from '@/lib/billing/upgrade-moments'

interface Props {
  context?: UpgradeMoment
}

export function UpgradeButton({ context }: Props) {
  const [loading, setLoading] = useState(false)
  const momentContent = context ? getUpgradeMomentContent(context) : null

  async function handleUpgrade() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'BUILDER' }),
      })
      if (!res.ok) {
        toast.error((await parseApiErrorResponse(res)).message)
        return
      }
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        toast.error('Checkout did not return a destination.')
      }
    } catch {
      toast.error('Could not start checkout. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      {momentContent && (
        <span className="text-xs text-muted-foreground max-w-48 text-right leading-snug">
          {momentContent.headline}
        </span>
      )}
      <Button variant="outline" size="sm" onClick={handleUpgrade} disabled={loading}>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Sparkles className="h-4 w-4 mr-2" />
        )}
        {momentContent ? momentContent.cta : 'Upgrade'}
      </Button>
    </div>
  )
}
