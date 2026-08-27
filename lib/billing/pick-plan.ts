'use client'

import { toast } from 'sonner'
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { BILLING_ACTION_COPY, SYSTEM_COPY } from '@/lib/marketing/copy'
import { getActiveAudit } from '@/lib/audit/active-audit'
import {
  requestPlanCheckout,
  type CheckoutOutcome,
  type CheckoutPlan,
} from '@/lib/billing/client-checkout'

export type PickerPlan = 'FREE' | 'BUILDER' | 'TEAM'
export type PickerSource =
  | 'post_signup'
  | 'post_signin'
  | 'pricing'
  | 'plan_picker'
  | 'billing'
  | 'unknown'

export interface PickPlanInput {
  plan: PickerPlan
  source?: PickerSource
  isLoggedIn: boolean
  currentPlan?: string
  waitlistGated?: boolean
  userEmail?: string
  fallbackPath?: string
  /** When true, route Free picks to the active report if one is mid-scan. */
  respectActiveReport?: boolean
  onPrivateBeta?: () => void
  /** Callback to navigate programmatically (e.g. window.location.replace for checkout). */
  onCheckoutRedirect?: (url: string) => void
}

export interface PickPlanResult {
  kind: 'free_dashboard' | 'free_report' | 'checkout_redirect' | 'waitlist' | 'unavailable' | 'error'
  url?: string
  message?: string
}

const REPORT_PATH = /^\/report\/[^/?#]+$/

function isReportPath(value: string | null | undefined): value is string {
  return typeof value === 'string' && REPORT_PATH.test(value)
}

/**
 * Centralized plan-pick decision tree.
 *
 * Pricing page CTAs, the post-auth plan picker, and the post-signup plan picker
 * all funnel through this function so the routing and checkout branches stay in
 * lockstep. The caller is responsible for navigation when
 * `kind` is `free_dashboard` or `free_report`; for `checkout_redirect` the
 * caller must hand `url` to `window.location` (or `onCheckoutRedirect`).
 */
export async function pickPlan(input: PickPlanInput): Promise<PickPlanResult> {
  const {
    plan,
    isLoggedIn,
    currentPlan,
    waitlistGated = false,
    fallbackPath,
    respectActiveReport = true,
    onPrivateBeta,
    onCheckoutRedirect,
  } = input

  if (plan === 'FREE') {
    if (respectActiveReport) {
      const active = getActiveAudit()
      if (active?.auditId) {
        return { kind: 'free_report', url: `/report/${active.auditId}` }
      }
    }
    if (isReportPath(fallbackPath)) {
      return { kind: 'free_report', url: fallbackPath }
    }
    return { kind: 'free_dashboard', url: fallbackPath ?? '/dashboard' }
  }

  const checkoutPlan: CheckoutPlan = plan === 'BUILDER' || plan === 'TEAM' ? plan : 'BUILDER'
  const isCurrent = isLoggedIn && currentPlan === plan

  if (isCurrent) {
    return { kind: 'free_dashboard', url: fallbackPath ?? '/dashboard' }
  }

  if (waitlistGated) {
    onPrivateBeta?.()
    return { kind: 'waitlist' }
  }

  const outcome: CheckoutOutcome = await requestPlanCheckout(checkoutPlan)

  if (outcome.kind === 'redirect') {
    if (outcome.existingSubscription) {
      toast.message(BILLING_ACTION_COPY.checkout.existingTitle, {
        description: BILLING_ACTION_COPY.checkout.existingBody,
      })
    }
    onCheckoutRedirect?.(outcome.url)
    return { kind: 'checkout_redirect', url: outcome.url }
  }

  if (outcome.kind === 'paid-checkout-closed') {
    onPrivateBeta?.()
    return { kind: 'waitlist' }
  }

  // Batch gate (server 403 BATCH_ACCESS_REQUIRED): paid is open, but this
  // user's waitlist batch has not been released. Route them back to the
  // waitlist join flow with the server's explanation instead of a generic
  // error toast. The check is keyed on the stable server message so the client
  // bundle never ships the open-batch value.
  if (outcome.kind === 'error' && outcome.message.includes('opens in batches')) {
    onPrivateBeta?.()
    return { kind: 'waitlist', message: outcome.message }
  }

  if (outcome.kind === 'unavailable') {
    toast.error(BILLING_ACTION_COPY.checkout.unavailableTitle, {
      description: outcome.message,
      action: {
        label: SYSTEM_COPY.actions.billing,
        onClick: () => {
          if (typeof window !== 'undefined') window.location.href = '/billing'
        },
      },
    })
    return { kind: 'unavailable', message: outcome.message }
  }

  const message =
    outcome.kind === 'error'
      ? outcome.message
      : outcome.kind === 'missing-destination'
        ? BILLING_ACTION_COPY.checkout.missingDestination
        : BILLING_ACTION_COPY.checkout.failed

  toast.error(message)
  return { kind: 'error', message }
}

/** Convenience wrapper for components that own a `router` instance. */
export function routerForPlanResult(router: AppRouterInstance, result: PickPlanResult): void {
  if (result.kind === 'free_dashboard' || result.kind === 'free_report') {
    if (result.url) router.push(result.url)
  }
}
