'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { parseApiErrorResponse } from '@/lib/api/parse-error'
import { getUpgradeMomentContent, type UpgradeMoment } from '@/lib/billing/upgrade-moments'

interface Props {
  context?: UpgradeMoment
  /** Target plan for checkout. Defaults to Pro. Use TEAM for Agency. */
  plan?: 'BUILDER' | 'TEAM'
}

export function UpgradeButton({ context, plan = 'BUILDER' }: Props) {
  const [loading, setLoading] = useState(false)
  const momentContent = context ? getUpgradeMomentContent(context) : null

  async function handleUpgrade() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json().catch(() => ({}))
      if (data.url && (res.ok || res.status === 409)) {
        if (res.status === 409) {
          toast.message('Opening billing portal', {
            description: 'Change or cancel your plan there.',
          })
        }
        window.location.href = data.url
        return
      }
      if (!res.ok) {
        toast.error((await parseApiErrorResponse(res)).message)
        return
      }
      toast.error('Checkout did not return a destination.')
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
        {momentContent ? momentContent.cta : plan === 'TEAM' ? 'Upgrade to Agency' : 'Upgrade'}
      </Button>
    </div>
  )
}
