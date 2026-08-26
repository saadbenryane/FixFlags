'use client'

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { AuthFlow } from '@/components/auth/AuthFlow'
import { AUTH, SCAN_LIMIT_GATE } from '@/lib/marketing/copy/auth'
import type { ReportClaimReason } from '@/lib/audit/access-context'

export type { ReportClaimReason }

export function ReportClaimDialog({
  open,
  onOpenChange,
  nextPath,
  from = 'report',
  auditId,
  reason = 'save-report',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  nextPath?: string | null
  from?: string
  auditId?: string
  reason?: ReportClaimReason
}) {
  const copy =
    reason === 'scan-limit'
      ? {
          title: SCAN_LIMIT_GATE.signup.title,
          body: SCAN_LIMIT_GATE.signup.body,
        }
      : reason === 'create-account'
        ? {
            title: AUTH.signUp.title,
            body: AUTH.signUp.subtitle,
          }
        : {
            title: AUTH.signUp.title,
            body: AUTH.reportContext.body,
          }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto overscroll-contain p-5 sm:p-6">
        <DialogTitle className="sr-only">{copy.title}</DialogTitle>
        <DialogDescription className="sr-only">{copy.body}</DialogDescription>
        <AuthFlow
          mode="signup"
          presentation="report-dialog"
          from={from}
          nextPath={nextPath}
          auditId={auditId}
          dialogTitle={copy.title}
          dialogSubtitle={copy.body}
        />
      </DialogContent>
    </Dialog>
  )
}
