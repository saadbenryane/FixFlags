'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Body, Heading } from '@/components/ui/typography'
import { MarketingEyebrow } from '@/components/marketing/MarketingEyebrow'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { useMe } from '@/hooks/useMe'
import { WAITLIST_PAGE, BILLING_ACTION_COPY } from '@/lib/marketing/copy-barrel'
import { trackEvent } from '@/lib/analytics/events'
import { submitWaitlistJoin, type CheckoutPlan } from '@/lib/billing/client-checkout'
import { toast } from 'sonner'
import { WaitlistAuthDialog } from '@/components/billing/WaitlistAuthDialog'
import { WAITLIST_PLAN_BY_SEGMENT, waitlistPathForSegment, type WaitlistPlanSegment } from '@/lib/billing/waitlist-path'

const PENDING_KEY = 'ff_waitlist_pending'

interface PendingJoin {
  email: string
  plan: CheckoutPlan
  source?: string
  campaign?: string
}

function readPendingJoin(): PendingJoin | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PendingJoin
    if (!parsed?.email || !parsed.plan) return null
    return parsed
  } catch {
    return null
  }
}

function clearPendingJoin() {
  try {
    sessionStorage.removeItem(PENDING_KEY)
  } catch {
    // sessionStorage unavailable (private mode): the join still completes.
  }
}

interface WaitlistLandingProps {
  segment: WaitlistPlanSegment
}

const SEGMENTS: readonly WaitlistPlanSegment[] = ['pro', 'team', 'agency']

export function WaitlistLanding({ segment }: WaitlistLandingProps) {
  const router = useRouter()
  const inputId = useId()
  const { user, isLoading } = useMe()
  // Segment is a server-passed prop (/waitlist, /waitlist/pro, /waitlist/team, /waitlist/agency).
  const plan = WAITLIST_PLAN_BY_SEGMENT[segment]
  const copy = WAITLIST_PAGE.plans[segment]
  // Agency has no internal plan yet; its joins record TEAM with their own source.
  const source = segment === 'agency' ? 'waitlist-agency' : 'waitlist'
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const completingRef = useRef(false)

  async function completeJoin(pending: PendingJoin) {
    if (completingRef.current) return
    completingRef.current = true
    setSubmitting(true)
    try {
      const outcome = await submitWaitlistJoin({
        email: pending.email,
        plan: pending.plan,
        source: pending.source ?? 'waitlist',
        campaign: pending.campaign,
      })
      if (outcome.kind === 'error') {
        toast.error(outcome.message)
        return
      }
      trackEvent('waitlist_joined', { plan: pending.plan, source: pending.source ?? 'waitlist' })
      clearPendingJoin()
      setSubmitted(true)
      setDialogOpen(false)
    } finally {
      setSubmitting(false)
      completingRef.current = false
    }
  }

  // SSO round-trip: the browser left for the provider and came back signed in.
  // Complete the pending waitlist join recorded before the dialog opened.
  useEffect(() => {
    if (!user || isLoading || submitted) return
    const pending = readPendingJoin()
    if (!pending) return
    void completeJoin(pending)
  }, [user, isLoading, submitted])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    setSubmitting(true)
    try {
      if (user) {
        // Signed in: join directly.
        const outcome = await submitWaitlistJoin({
          email: trimmed,
          plan,
          source,
        })
        if (outcome.kind === 'error') {
          toast.error(outcome.message)
          return
        }
        trackEvent('waitlist_joined', { plan, source })
        setSubmitted(true)
        return
      }
      // Signed out: remember the join, then open the unified auth modal with the
      // email prefilled. After auth (email or SSO) the join completes.
      const pending: PendingJoin = { email: trimmed, plan, source }
      try {
        sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending))
      } catch {
        // sessionStorage unavailable: still open the modal, the email is prefilled.
      }
      setDialogOpen(true)
    } finally {
      setSubmitting(false)
    }
  }

  const planLabel = copy.label

  return (
    <Section spacing="tight" className="relative overflow-hidden">
      <Container variant="marketing" className="mx-auto max-w-2xl px-4 py-14 sm:px-6 sm:py-20">
        <MarketingEyebrow>{WAITLIST_PAGE.eyebrow}</MarketingEyebrow>
        <Heading
          as="h1"
          className="mt-4 font-display text-balance text-4xl font-bold leading-display tracking-display sm:text-5xl"
        >
          {WAITLIST_PAGE.headline}
        </Heading>
        <Body className="mt-4 max-w-xl text-muted-foreground text-pretty sm:text-lg">
          {WAITLIST_PAGE.subhead}
        </Body>

        <SegmentedControl
          size="md"
          value={segment}
          onValueChange={(value) => router.push(waitlistPathForSegment(value as WaitlistPlanSegment) as Route)}
          items={SEGMENTS.map((value) => ({ value, label: WAITLIST_PAGE.plans[value].label }))}
          aria-label="Plan"
          className="mt-8"
        />

        <div className="mt-3 flex items-baseline gap-2 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{planLabel}</span>
          <span>{copy.detail}</span>
        </div>

        {submitted ? (
          <div
            className="mt-8 flex items-center justify-center gap-2 rounded-card border border-border/60 bg-background/80 px-4 py-6 text-sm text-foreground shadow-sm"
            role="status"
          >
            <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden />
            {BILLING_ACTION_COPY.waitlist.success}
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mt-8 space-y-2 rounded-card border border-border/60 bg-background/80 p-4 shadow-sm sm:p-5"
          >
            <label htmlFor={inputId} className="sr-only">
              Email address
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id={inputId}
                name="email"
                type="email"
                autoComplete="email"
                placeholder={WAITLIST_PAGE.emailPlaceholder}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                disabled={submitting}
                className="min-w-0 flex-1"
              />
              <Button
                type="submit"
                loading={submitting}
                loadingLabel={BILLING_ACTION_COPY.waitlist.submitting}
                disabled={!email.trim()}
              >
                {copy.submit}
              </Button>
            </div>
            {!user ? <div className="text-center text-xs leading-snug"><Link className="inline-flex min-h-11 items-center underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" href={`/sign-up?next=${encodeURIComponent(waitlistPathForSegment(segment))}&from=waitlist` as Route}>{WAITLIST_PAGE.signUpRequired}</Link></div> : null}
          </form>
        )}

        <div className="mt-8 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
          <div className="rounded-card bg-muted/40 p-4">
            <p className="font-medium text-foreground">
              {BILLING_ACTION_COPY.tierOffers.tier1Label}
            </p>
            <p className="mt-1 leading-snug">
              First 500 joiners on {planLabel} get 25% off for 12 months from launch.
            </p>
          </div>
          <div className="rounded-card bg-muted/40 p-4">
            <p className="font-medium text-foreground">
              {BILLING_ACTION_COPY.tierOffers.tier2Label}
            </p>
            <p className="mt-1 leading-snug">
              Next 500 joiners get 15% off for 12 months from launch.
            </p>
          </div>
        </div>
      </Container>

      <WaitlistAuthDialog
        open={dialogOpen}
        initialEmail={email}
        segment={segment}
        onClose={() => setDialogOpen(false)}
        onAuthenticated={() => completeJoin(readPendingJoin() ?? { email, plan, source })}
      />
    </Section>
  )
}
