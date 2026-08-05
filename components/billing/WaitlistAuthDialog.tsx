'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { AuthFlow } from '@/components/auth/AuthFlow'
import { WAITLIST_PAGE } from '@/lib/marketing/copy'

export type WaitlistDialogPlan = 'BUILDER' | 'TEAM'

export function waitlistPathForPlan(plan: WaitlistDialogPlan): string {
  return plan === 'TEAM' ? '/waitlist/studio' : '/waitlist/pro'
}

interface WaitlistAuthDialogProps {
  open: boolean
  initialEmail: string
  plan: WaitlistDialogPlan
  onClose: () => void
  onAuthenticated: () => Promise<void> | void
}

/**
 * Unified auth modal for the waitlist join. One flow for everyone: SSO buttons
 * plus the email signup/sign-in form, prefilled with the email entered on the
 * waitlist page. The flow never branches on whether an email already has an
 * account, so no existence signal leaks. SSO callbacks return directly to the
 * waitlist page (bypassing /post-login) so the pending join completes there.
 */
export function WaitlistAuthDialog({
  open,
  initialEmail,
  plan,
  onClose,
  onAuthenticated,
}: WaitlistAuthDialogProps) {
  const callbackURL = waitlistPathForPlan(plan)

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto overscroll-contain p-5 sm:p-6"
      >
        <DialogTitle className="sr-only">{WAITLIST_PAGE.authDialogTitle}</DialogTitle>
        <DialogDescription className="sr-only">
          {WAITLIST_PAGE.authDialogBody}
        </DialogDescription>
        <AuthFlow
          mode="signup"
          presentation="report-dialog"
          nextPath={callbackURL}
          from="waitlist"
          initialEmail={initialEmail}
          oauthCallbackURL={callbackURL}
          oauthNewUserCallbackURL={callbackURL}
          dialogTitle={WAITLIST_PAGE.authDialogTitle}
          dialogSubtitle={WAITLIST_PAGE.authDialogBody}
          onAuthenticated={onAuthenticated}
        />
      </DialogContent>
    </Dialog>
  )
}
