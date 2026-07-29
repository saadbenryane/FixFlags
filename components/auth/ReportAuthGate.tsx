'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { AuthFlow } from '@/components/auth/AuthFlow'
import { Button } from '@/components/ui/button'
import { AUTH } from '@/lib/marketing/copy/auth'
import { useMe } from '@/hooks/useMe'
import { trackEvent } from '@/lib/analytics/events'
import { displayHostname } from '@/lib/utils/url-helpers'

export function ReportAuthGate({
  auditId,
  required,
  reportUrl,
}: {
  auditId: string
  required: boolean
  reportUrl?: string | null
}) {
  const router = useRouter()
  const { user, claimAnonymous } = useMe({ load: false })
  const [claiming, setClaiming] = useState(false)
  const tracked = useRef(false)

  useEffect(() => {
    if (!required || tracked.current) return
    tracked.current = true
    trackEvent('report_auth_gate_viewed', { audit_id: auditId })
  }, [auditId, required])

  async function handleAuthenticated() {
    setClaiming(true)
    const result = await claimAnonymous({ showToast: false })
    if (!result?.user) {
      setClaiming(false)
      return
    }
    trackEvent('report_auth_gate_completed', { audit_id: auditId })
    trackEvent('report_claimed', { audit_id: auditId })
    router.refresh()
  }

  if (!required || user) return null
  const hostname = reportUrl ? displayHostname(reportUrl) : null
  const description = AUTH.reportGate.subtitle(hostname)

  return (
    <Dialog open>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto overscroll-contain p-5 sm:p-6 [&>button]:hidden"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogTitle className="sr-only">{AUTH.reportGate.title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>
        {claiming ? (
          <div
            className="flex min-h-72 flex-col items-center justify-center gap-3 text-center"
            role="status"
          >
            <Loader2 className="h-7 w-7 animate-spin text-brand" aria-hidden />
            <div>
              <p className="font-medium text-foreground">{AUTH.reportGate.saving}</p>
              <p className="mt-1 text-sm text-muted-foreground">{AUTH.reportGate.savingBody}</p>
            </div>
          </div>
        ) : (
          <>
            <AuthFlow
              mode="signup"
              presentation="report-dialog"
              nextPath={`/report/${auditId}`}
              from="report"
              auditId={auditId}
              reportHostname={hostname}
              onAuthenticated={handleAuthenticated}
            />
            <Button asChild variant="ghost" className="w-full">
              <Link href="/">{AUTH.reportGate.exit}</Link>
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
