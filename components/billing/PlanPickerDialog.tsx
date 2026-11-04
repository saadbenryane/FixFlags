'use client'

import type { Route } from 'next'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Flag, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMe } from '@/hooks/useMe'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet'
import { BILLING_ACTION_COPY, PLANS, PRICING } from '@/lib/marketing/copy-barrel'
import { PlanPrice } from '@/components/pricing/PlanPrice'
import { useAuthRedirect } from '@/hooks/useAuthRedirect'
import { trackEvent } from '@/lib/analytics/events'
import { pickPlan, routerForPlanResult, type PickPlanResult, type PickerPlan, type PickerSource } from '@/lib/billing/pick-plan'
import { getActiveAudit } from '@/lib/audit/active-audit'
import { isPaidCheckoutGatedClient } from '@/lib/billing/paid-open'
import { waitlistPathForPlan } from '@/lib/billing/waitlist-path'
import type { CheckoutPlan } from '@/lib/billing/client-checkout'
import { cn } from '@/lib/utils'
import { useSiteAction } from '@/hooks/useSiteAction'
import { toast } from 'sonner'

type SelectionResult = PickPlanResult | { kind: 'sign_up'; url: string }

const PLAN_ICONS: Record<PickerPlan, typeof ShieldCheck> = {
  FREE: ShieldCheck,
  BUILDER: Flag,
  TEAM: Users,
}

const DISMISS_KEY = 'ff:plan-picker-dismissed'

function preventDismissal(event: Event) { event.preventDefault() }

interface PlanPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** User dismissal only. Successful selections own their navigation. */
  onDismiss?: () => void
  source: PickerSource
  fallbackPath?: string
  /** Use a remembered Site only when there is no explicit return intent. */
  respectActiveReport?: boolean
  /** When false, Escape and outside click close the dialog (billing). Default true for onboarding. */
  lockDismissal?: boolean
}

export function PlanPickerDialog({
  open,
  onOpenChange,
  onDismiss,
  source,
  fallbackPath,
  respectActiveReport = true,
  lockDismissal = true,
}: PlanPickerDialogProps) {
  const router = useRouter()
  const { user, isLoading: meLoading } = useMe({ load: true })
  const { signUpHref } = useAuthRedirect()
  const [busyPlan, setBusyPlan] = useState<PickerPlan | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const dismissalHandlers = {
    onEscapeKeyDown: lockDismissal ? preventDismissal : undefined,
    onPointerDownOutside: lockDismissal ? preventDismissal : undefined,
    onInteractOutside: lockDismissal ? preventDismissal : undefined,
  }
  const trackedView = useRef<string | null>(null)
  const { busy, submit } = useSiteAction({ scope: JSON.stringify(['plan-picker', open, user?.id, user?.plan, source, fallbackPath, respectActiveReport]) })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 639px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!open) { trackedView.current = null; return }
    if (meLoading) return
    const identity = JSON.stringify([user?.id, source])
    if (trackedView.current === identity) return
    trackedView.current = identity
    trackEvent('plan_picker_viewed', {
      source,
      current_plan: user?.plan ?? undefined,
    })
  }, [open, meLoading, user?.id, user?.plan, source])

  function trackPicked(plan: PickerPlan) {
    trackEvent('plan_picker_picked', { plan, source })
  }

  function trackDismissed() {
    trackEvent('plan_picker_dismissed', { source })
  }

  function rememberDecision() {
    if (!lockDismissal) return
    try { sessionStorage.setItem(DISMISS_KEY, '1') }
    catch { /* Navigation still works without browser-local storage. */ }
  }

  async function handlePick(plan: PickerPlan) {
    if (!open || meLoading) return
    const completion = await submit<SelectionResult>(async signal => {
      setBusyPlan(plan)
      trackPicked(plan)
      if (!user) return plan === 'FREE' ? { kind: 'sign_up', url: signUpHref() }
        : { kind: 'waitlist', url: waitlistPathForPlan(plan as CheckoutPlan) }
      return pickPlan({ plan, source, signal,
        isLoggedIn: true, currentPlan: user.plan,
        waitlistGated: isPaidCheckoutGatedClient(), userEmail: user.email ?? undefined, fallbackPath, respectActiveReport,
      })
    }, result => {
      if (result.kind === 'sign_up') { router.push(result.url as Route); return null }
      if (result.kind === 'demo' && result.url) {
        onOpenChange(false)
        router.push(result.url as Route)
        return null
      }
      if (result.kind === 'waitlist') {
        onOpenChange(false)
        router.push((result.url ?? waitlistPathForPlan(plan as CheckoutPlan)) as Route)
        return null
      }
      if (result.kind === 'checkout_redirect') {
        if (result.url) { window.location.assign(result.url); onOpenChange(false) }
        return null
      }
      if (result.kind === 'unavailable' || result.kind === 'error' || result.kind === 'cancelled') return null
      if (plan === 'FREE') rememberDecision()
      routerForPlanResult(router, result)
      onOpenChange(false)
      return null
    })
    if (completion.kind === 'refused') toast.error(BILLING_ACTION_COPY.checkout.failed)
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      rememberDecision()
      trackDismissed()
    }
    onOpenChange(next)
    if (!next) onDismiss?.()
  }

  const activeAudit = typeof window !== 'undefined' ? getActiveAudit() : null
  const hasPendingReport = Boolean(activeAudit?.auditId)

  const body = (
    <div className="space-y-5">
      <div className="space-y-1.5 text-center sm:text-left">
        <p className="section-label">
          {PRICING.pickerEyebrow}
        </p>
        <p className="text-sm text-muted-foreground text-pretty">
          {hasPendingReport
            ? PRICING.pickerBodyWithReport
            : PRICING.pickerBody}
        </p>
        <p className="text-xs text-muted-foreground text-pretty">
          {PRICING.pickerCreditNote}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
        {PLANS.map((plan) => {
          const planKey = plan.plan as PickerPlan
          const Icon = PLAN_ICONS[planKey]
          const isCurrent = user?.plan === planKey
          const continuesFree = planKey === 'FREE' && (source === 'post_signup' || source === 'post_signin')
          const isBusy = busy && busyPlan === planKey
          const isHighlight = planKey === 'BUILDER'
          return (
            <div
              key={planKey}
              className={cn(
                'relative flex h-full flex-col gap-4 rounded-card border border-border/40 bg-background/85 p-4 shadow-card',
                isHighlight && 'ring-1 ring-brand/30 bg-[linear-gradient(180deg,hsl(var(--brand)/0.06),hsl(var(--background)/0.94))]'
              )}
            >
              {planKey === 'FREE' ? (
                <span className="absolute -top-2.5 right-4 rounded-full bg-brand px-2.5 py-0.5 text-2xs font-semibold text-brand-foreground">
                  {PRICING.pickerRecommended}
                </span>
              ) : null}
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-foreground',
                    isHighlight ? 'bg-brand/10 text-brand' : 'bg-muted/70'
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold tracking-heading text-foreground">
                    {plan.name}
                  </p>
                  <p className="text-2xs text-muted-foreground">{plan.persona}</p>
                </div>
                {isCurrent ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-2xs font-medium text-muted-foreground">
                    {PRICING.pickerCurrentPlan}
                  </span>
                ) : null}
              </div>

              <div>
                <p className="mb-1 text-xs text-muted-foreground">{plan.priceLabel}</p>
                <div className="flex items-end gap-1">
                  <PlanPrice price={plan.price} size="md" className="text-foreground" />
                  {plan.period ? (
                    <span className="pb-0.5 text-xs text-muted-foreground">
                      {plan.period}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-2xs font-medium text-muted-foreground">
                  {plan.audits}
                </p>
              </div>

              <ul className="flex-1 space-y-1.5 text-xs leading-snug text-muted-foreground">
                {plan.features.slice(0, 3).map((feature) => (
                  <li key={feature} className="flex items-start gap-1.5">
                    <CheckCircle2
                      className={cn(
                        'mt-0.5 h-3.5 w-3.5 shrink-0',
                        isHighlight ? 'text-brand' : 'text-muted-foreground/80'
                      )}
                      aria-hidden
                    />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {isCurrent && !continuesFree ? (
                <Button variant="outline" disabled className="w-full">
                  {PRICING.pickerCurrentPlan}
                </Button>
              ) : (
                <Button
                  variant={isHighlight ? 'default' : 'outline'}
                  className="w-full"
                  onClick={() => void handlePick(planKey)}
                  disabled={busy || meLoading}
                  loading={isBusy}
                  loadingLabel={isBusy ? PRICING.pickerBusy : undefined}
                >
                  {!isBusy && isHighlight ? <Sparkles className="h-4 w-4" aria-hidden /> : null}
                  {planKey === 'FREE'
                    ? PRICING.pickerFreeCta
                    : planKey === 'BUILDER'
                      ? PRICING.pickerProCta
                      : PRICING.pickerStudioCta}
                </Button>
              )}
            </div>
          )
        })}
      </div>

      {hasPendingReport ? (
        <p className="text-center text-2xs text-muted-foreground sm:text-left">
          {PRICING.pickerReportNote}
        </p>
      ) : null}

      <p className="text-center text-2xs text-muted-foreground sm:text-left">
        {PRICING.pickerFootnote}
        {' '}
        <a
          href="/pricing"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {PRICING.pickerCompareLink}
        </a>
      </p>
    </div>
  )

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[92dvh] w-full"
          {...dismissalHandlers}
          header={<>
            <div aria-hidden className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-muted-foreground/30" />
            <div className="pt-2">
              <SheetTitle className="text-base font-semibold tracking-heading text-foreground">
                {PRICING.pickerTitle}
              </SheetTitle>
              <SheetDescription className="mt-0.5 text-xs text-muted-foreground">
                {PRICING.pickerSubtitle}
              </SheetDescription>
            </div>
          </>}
        >
          {body}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        header={<DialogTitle className="text-lg font-semibold tracking-heading text-foreground">
              {PRICING.pickerTitle}
            </DialogTitle>}
        className="max-w-3xl"
        {...dismissalHandlers}
      >
        <DialogDescription className="mt-1 text-sm text-muted-foreground">
              {PRICING.pickerSubtitle}
            </DialogDescription>
        <div className="mt-5">{body}</div>
      </DialogContent>
    </Dialog>
  )
}

export function isPlanPickerDismissed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function resetPlanPickerDismissal(): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(DISMISS_KEY)
  } catch {
    // ignore
  }
}
