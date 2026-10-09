'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { SitePromptCopyButton } from '@/components/sites/SitePromptCopyButton'

export function SiteFlagActions({ siteId, flagId, verifying = false }: { siteId: string; flagId: string; verifying?: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [verificationRunning, setVerificationRunning] = useState(verifying)
  const [message, setMessage] = useState<string | null>(null)
  const [changeSummary, setChangeSummary] = useState('')
  const [verifyOpen, setVerifyOpen] = useState(false)

  useEffect(() => {
    setVerificationRunning(verifying)
  }, [verifying])

  useEffect(() => {
    if (!verificationRunning) return
    const timer = window.setInterval(() => router.refresh(), 4000)
    return () => window.clearInterval(timer)
  }, [router, verificationRunning])

  async function verify() {
    setBusy(true)
    try {
      const res = await fetch(`/api/sites/${siteId}/flags/${flagId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `web:verify:${flagId}:${crypto.randomUUID()}`,
        },
        body: JSON.stringify({ changeSummary: changeSummary.trim() }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        error?: string
        message?: string
        signup?: boolean
      }
      if (res.status === 401 || body.signup) {
        router.push(`/sign-up?next=${encodeURIComponent(`/sites/${siteId}/flags/${flagId}`)}`)
        return
      }
      if (!res.ok) {
        setMessage(body.message || body.error || SITE_BOARD_COPY.verificationFailed)
        return
      }
      setVerificationRunning(true)
      setVerifyOpen(false)
      setMessage(SITE_BOARD_COPY.verificationStarted)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-start gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background" aria-hidden="true">
            1
          </span>
          <div>
            <h3 className="font-semibold">{SITE_BOARD_COPY.fixStep}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{SITE_BOARD_COPY.fixStepBody}</p>
          </div>
        </div>
        <div className="mt-4 [&>span]:w-full [&_button]:w-full"><SitePromptCopyButton siteId={siteId} flagId={flagId} /></div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{SITE_BOARD_COPY.copyDoesNotResolve}</p>
      </div>

      <div className="border-t border-border/80 pt-5">
        <div className="flex items-start gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brand text-xs font-semibold text-foreground" aria-hidden="true">
            2
          </span>
          <div>
            <h3 className="font-semibold">{SITE_BOARD_COPY.verifyStep}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{SITE_BOARD_COPY.verifyStepBody}</p>
          </div>
        </div>
        <Button className="mt-4 w-full" variant="brand" disabled={busy || verificationRunning} onClick={() => setVerifyOpen(true)}>
          <ShieldCheck aria-hidden="true" />
          {verificationRunning ? SITE_BOARD_COPY.verifying : SITE_BOARD_COPY.verifyFix}
        </Button>
        {message ? (
          <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
            {message}
          </p>
        ) : null}
      </div>
      <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
        <DialogContent>
          <DialogTitle>{SITE_BOARD_COPY.verifyFix}</DialogTitle>
          <DialogDescription>FixFlags will independently analyze the same page and behavior. The Flag stays open unless the evidence proves recovery.</DialogDescription>
          <div className="space-y-1">
            <label htmlFor="flag-change-summary" className="text-sm font-medium">{SITE_BOARD_COPY.changeLabel}</label>
            <p id="flag-change-summary-hint" className="text-xs text-muted-foreground">{SITE_BOARD_COPY.changeHint}</p>
            <Textarea id="flag-change-summary" aria-describedby="flag-change-summary-hint" value={changeSummary} onChange={(event) => setChangeSummary(event.target.value)} rows={3} placeholder={SITE_BOARD_COPY.changePlaceholder} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setVerifyOpen(false)}>Cancel</Button>
            <Button type="button" variant="brand" disabled={busy} onClick={() => void verify()}>{busy ? SITE_BOARD_COPY.verifying : SITE_BOARD_COPY.verifyFix}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
