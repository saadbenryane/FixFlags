'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Sparkles, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { parseApiErrorResponse } from '@/lib/api/parse-error'
import { trackEvent } from '@/lib/analytics/events'
import { getUpgradeMomentContent, type UpgradeMoment } from '@/lib/billing/upgrade-moments'

interface Props {
  context?: UpgradeMoment
  /** Target plan for checkout. Defaults to Pro. Use TEAM for Agency. */
  plan?: 'BUILDER' | 'TEAM'
  betaGated?: boolean
  userEmail?: string
}

export function UpgradeButton({ context, plan = 'BUILDER', betaGated, userEmail }: Props) {
  const [loading, setLoading] = useState(false)
  const [betaState, setBetaState] = useState<'idle' | 'submitting' | 'done'>('idle')
  const [betaEmail, setBetaEmail] = useState(userEmail ?? '')
  const momentContent = context ? getUpgradeMomentContent(context) : null

  async function handleBetaSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!betaEmail) return
    setBetaState('submitting')
    try {
      const res = await fetch('/api/stripe/beta-interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: betaEmail, plan, name: '' }),
      })
      if (res.ok) {
        setBetaState('done')
        trackEvent('beta_interest_submitted', { plan, email: betaEmail })
      } else {
        toast.error('Could not submit. Try again.')
        setBetaState('idle')
      }
    } catch {
      toast.error('Could not submit. Try again.')
      setBetaState('idle')
    }
  }

  async function handleUpgrade() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json().catch(() => ({}))
      if (data.code === 'PRIVATE_BETA') {
        setBetaState('idle')
        return
      }
      if (data.url && (res.ok || res.status === 409)) {
        trackEvent('started_checkout', { plan, is_logged_in: true })
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

  if (betaState === 'done') {
    return (
      <div className="flex items-center gap-2 text-sm text-foreground">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        You&apos;re on the list.
      </div>
    )
  }

  if (betaState !== 'idle') {
    return (
      <form onSubmit={handleBetaSubmit} className="flex items-center gap-2">
        <Input
          type="email"
          placeholder="you@example.com"
          value={betaEmail}
          onChange={(e) => setBetaEmail(e.target.value)}
          required
          disabled={betaState === 'submitting'}
          className="max-w-xs"
        />
        <Button type="submit" size="sm" disabled={betaState === 'submitting' || !betaEmail}>
          {betaState === 'submitting' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Join beta'
          )}
        </Button>
      </form>
    )
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
        {betaGated
          ? `Join ${plan === 'TEAM' ? 'Studio' : 'Pro'} beta`
          : momentContent
            ? momentContent.cta
            : plan === 'TEAM'
              ? 'Upgrade to Studio'
              : 'Upgrade'}
      </Button>
    </div>
  )
}
