'use client'

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { lazy, Suspense } from 'react'
import { AUTH, SCAN_LIMIT_GATE } from '@/lib/marketing/copy/auth'
import type { ReportClaimReason } from '@/lib/audit/access-context'

export type { ReportClaimReason }

const AuthFlow = lazy(() => import('@/components/auth/AuthFlow').then(module => ({ default: module.AuthFlow })))

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
      <DialogContent header={<DialogTitle className="sr-only">{copy.title}</DialogTitle>} className="max-h-[calc(100dvh-2rem)] w-[calc(100%-1.5rem)] max-w-md">
        <DialogDescription className="sr-only">{copy.body}</DialogDescription>
        <Suspense fallback={<p role="status" className="py-8 text-center text-sm text-muted-foreground">{AUTH.reportGate.preparingOptions}</p>}>
          <AuthFlow
            mode="signup"
            presentation="report-dialog"
            from={from}
            nextPath={nextPath}
            auditId={auditId}
            dialogTitle={copy.title}
            dialogSubtitle={copy.body}
          />
        </Suspense>
      </DialogContent>
    </Dialog>
  )
}
