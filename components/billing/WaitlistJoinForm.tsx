'use client'

import { useId, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BILLING_ACTION_COPY } from '@/lib/marketing/copy'
import {
  submitWaitlistJoin,
  type CheckoutPlan,
} from '@/lib/billing/client-checkout'
import { trackEvent } from '@/lib/analytics/events'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface WaitlistJoinFormProps {
  plan: CheckoutPlan
  initialEmail?: string
  compact?: boolean
  source?: string
}

export function WaitlistJoinForm({
  plan,
  initialEmail = '',
  compact = false,
  source = 'pricing',
}: WaitlistJoinFormProps) {
  const inputId = useId()
  const [email, setEmail] = useState(initialEmail)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const emailLocked = Boolean(initialEmail)
  const submitLabel =
    plan === 'TEAM'
      ? BILLING_ACTION_COPY.waitlist.submitStudio
      : BILLING_ACTION_COPY.waitlist.submitPro

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!email.trim()) return

    setSubmitting(true)
    const outcome = await submitWaitlistJoin({
      email: email.trim(),
      plan,
      source,
    })
    setSubmitting(false)

    if (outcome.kind === 'error') {
      toast.error(outcome.message)
      return
    }

    trackEvent('waitlist_joined', { plan, source })
    trackEvent('beta_interest_submitted', { plan, email: email.trim() })
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="flex items-center justify-center gap-2 text-sm text-foreground" role="status">
        <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
        {BILLING_ACTION_COPY.waitlist.success}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-2', compact && 'max-w-md')}>
      <label htmlFor={inputId} className="sr-only">
        Email address
      </label>
      <div className={cn('flex gap-2', !compact && 'flex-col sm:flex-row')}>
        <Input
          id={inputId}
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          disabled={submitting || emailLocked}
          readOnly={emailLocked}
          className="min-w-0 flex-1"
        />
        <Button
          type="submit"
          loading={submitting}
          loadingLabel={BILLING_ACTION_COPY.waitlist.submitting}
          disabled={!email.trim()}
        >
          {submitLabel}
        </Button>
      </div>
      <p className="text-center text-3xs leading-snug text-muted-foreground">
        {BILLING_ACTION_COPY.waitlist.description}
      </p>
    </form>
  )
}

/** @deprecated Use WaitlistJoinForm */
export const BetaInterestForm = WaitlistJoinForm
