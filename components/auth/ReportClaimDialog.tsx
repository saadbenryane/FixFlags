'use client'

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { AuthFlow } from '@/components/auth/AuthFlow'
import { SCAN_LIMIT_GATE } from '@/lib/marketing/copy/auth'

export function ReportClaimDialog({
  open,
  onOpenChange,
  nextPath,
  from = 'report',
  auditId,
  onAuthenticated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  nextPath?: string | null
  from?: string
  auditId?: string
  onAuthenticated?: () => Promise<void> | void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto overscroll-contain p-5 sm:p-6">
        <DialogTitle className="sr-only">{SCAN_LIMIT_GATE.signup.title}</DialogTitle>
        <DialogDescription className="sr-only">
          {SCAN_LIMIT_GATE.signup.body}
        </DialogDescription>
        <AuthFlow
          mode="signup"
          presentation="report-dialog"
          from={from}
          nextPath={nextPath}
          auditId={auditId}
          dialogTitle={SCAN_LIMIT_GATE.signup.title}
          dialogSubtitle={SCAN_LIMIT_GATE.signup.body}
          onAuthenticated={onAuthenticated}
        />
      </DialogContent>
    </Dialog>
  )
}
