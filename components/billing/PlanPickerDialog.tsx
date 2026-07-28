'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, ShieldCheck, Sparkles, Users, X, Zap } from 'lucide-react'
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
import { PLANS, PRICING } from '@/lib/marketing/copy'
import { SYSTEM_COPY } from '@/lib/marketing/copy/errors'
import { useAuthRedirect } from '@/hooks/useAuthRedirect'
import { trackEvent } from '@/lib/analytics/events'
import {
  pickPlan,
  routerForPlanResult,
  type PickerPlan,
  type PickerSource,
} from '@/lib/billing/pick-plan'
import { getActiveAudit } from '@/lib/audit/active-audit'
import { cn } from '@/lib/utils'

const PLAN_ICONS: Record<PickerPlan, typeof ShieldCheck> = {
  FREE: ShieldCheck,
  BUILDER: Zap,
  TEAM: Users,
}

const DISMISS_KEY = 'ff:plan-picker-dismissed'

interface PlanPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  source: PickerSource
  fallbackPath?: string
}

export function PlanPickerDialog({
  open,
  onOpenChange,
  source,
  fallbackPath,
}: PlanPickerDialogProps) {
  const router = useRouter()
  const { user, isLoading: meLoading } = useMe({ load: true })
  const { signUpHref } = useAuthRedirect()
  const [busyPlan, setBusyPlan] = useState<PickerPlan | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [trackedView, setTrackedView] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 639px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (meLoading || trackedView) return
    setTrackedView(true)
    trackEvent('plan_picker_viewed', {
      source,
      current_plan: user?.plan ?? undefined,
    })
  }, [meLoading, trackedView, user?.plan, source])

  function trackPicked(plan: PickerPlan) {
    trackEvent('plan_picker_picked', { plan, source })
  }

  function trackDismissed() {
    trackEvent('plan_picker_dismissed', { source })
  }

  async function handlePick(plan: PickerPlan) {
    trackPicked(plan)
    if (!user) {
      router.push(signUpHref())
      return
    }

    setBusyPlan(plan)
    const result = await pickPlan({
      plan,
      source,
      isLoggedIn: Boolean(user),
      currentPlan: user?.plan,
      betaGated: process.env.NEXT_PUBLIC_STRIPE_BETA_GATING === 'true',
      userEmail: user?.email ?? undefined,
      fallbackPath,
      onCheckoutRedirect: (url) => {
        window.location.href = url
      },
    })
    setBusyPlan(null)

    if (result.kind === 'private_beta') {
      onOpenChange(false)
      window.location.href = '/pricing'
      return
    }
    if (result.kind === 'checkout_redirect') {
      onOpenChange(false)
      return
    }
    if (result.kind === 'unavailable' || result.kind === 'error') {
      return
    }

    routerForPlanResult(router, result)
    onOpenChange(false)
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      try {
        sessionStorage.setItem(DISMISS_KEY, '1')
      } catch {
        // sessionStorage unavailable: still allow the close to register.
      }
      trackDismissed()
    }
    onOpenChange(next)
  }

  const activeAudit = typeof window !== 'undefined' ? getActiveAudit() : null
  const hasPendingReport = Boolean(activeAudit?.auditId)

  const body = (
    <div className="space-y-5">
      <div className="space-y-1.5 text-center sm:text-left">
        <p className="font-mono text-2xs font-medium uppercase tracking-label text-muted-foreground">
          {PRICING.pickerEyebrow}
        </p>
        <p className="text-sm text-muted-foreground text-pretty">
          {hasPendingReport
            ? PRICING.pickerBodyWithReport
            : PRICING.pickerBody}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
        {PLANS.map((plan) => {
          const planKey = plan.plan as PickerPlan
          const Icon = PLAN_ICONS[planKey]
          const isCurrent = user?.plan === planKey
          const isBusy = busyPlan === planKey
          const isHighlight = planKey === 'BUILDER'
          return (
            <div
              key={planKey}
              className={cn(
                'relative flex h-full flex-col gap-4 rounded-card border border-border/40 bg-background/85 p-4 shadow-card',
                isHighlight && 'ring-1 ring-brand/30 bg-[linear-gradient(180deg,hsl(var(--brand)/0.06),hsl(var(--background)/0.94))]'
              )}
            >
              {isHighlight ? (
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
                <div className="flex items-end gap-1">
                  <span className="font-mono text-2xl font-semibold tabular-nums tracking-display text-foreground">
                    {plan.price}
                  </span>
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

              {isCurrent ? (
                <Button variant="outline" disabled className="w-full">
                  {PRICING.pickerCurrentPlan}
                </Button>
              ) : (
                <Button
                  variant={isHighlight ? 'default' : 'outline'}
                  className="w-full"
                  onClick={() => void handlePick(planKey)}
                  disabled={busyPlan !== null}
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
          className="flex max-h-[92dvh] w-full flex-col gap-0 overflow-y-auto p-0"
        >
          <div
            aria-hidden
            className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30"
          />
          <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border/40 bg-background/95 px-5 pb-4 pt-3 backdrop-blur">
            <div>
              <SheetTitle className="text-base font-semibold tracking-heading text-foreground">
                {PRICING.pickerTitle}
              </SheetTitle>
              <SheetDescription className="mt-0.5 text-xs text-muted-foreground">
                {PRICING.pickerSubtitle}
              </SheetDescription>
            </div>
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              aria-label={SYSTEM_COPY.actions.close}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div className="flex-1 px-5 py-5">{body}</div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] w-[calc(100%-1.5rem)] max-w-3xl overflow-y-auto overscroll-contain p-5 sm:p-6 [&>button]:hidden"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <DialogTitle className="text-lg font-semibold tracking-heading text-foreground">
              {PRICING.pickerTitle}
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-muted-foreground">
              {PRICING.pickerSubtitle}
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            aria-label={SYSTEM_COPY.actions.close}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="mt-5">{body}</div>
        {busyPlan ? (
          <div className="mt-4 flex items-center justify-center gap-2 text-2xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            {PRICING.pickerBusy}
          </div>
        ) : null}
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
