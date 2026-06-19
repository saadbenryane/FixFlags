'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupInput } from '@/components/ui/input-group'
import { ArrowRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { HERO } from '@/lib/marketing/copy'
import { SAMPLE_AUDIT_URL } from '@/lib/marketing/display-meta'
import { parseApiErrorResponse } from '@/lib/api/parse-error'
import { AuditLimitGate } from '@/components/audit/AuditLimitGate'
import { QueuePosition } from '@/components/audit/QueuePosition'
import { setActiveAudit } from '@/lib/audit/active-audit'
import { cn } from '@/lib/utils'
import { trackEvent } from '@/lib/analytics/events'

export function AuditInput({
  variant = 'default',
  source,
  idSuffix = '',
}: {
  variant?: 'default' | 'landing'
  /** Audit attribution source sent to POST /api/checks (defaults from variant). */
  source?: 'homepage' | 'dashboard' | 'report'
  idSuffix?: string
}) {
  const inputId = `audit-url${idSuffix}`
  const errorId = `audit-url-error${idSuffix}`
  const helperId = `audit-url-helper${idSuffix}`
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [urlError, setUrlError] = useState('')
  const [limitGate, setLimitGate] = useState<{
    message: string
    code?: string
    action?: string
  } | null>(null)
  const [queueHold, setQueueHold] = useState<{ estimatedWaitSeconds: number } | null>(null)

  async function submitUrl(inputUrl?: string) {
    setUrlError('')
    setLimitGate(null)
    setQueueHold(null)

    let normalized = (inputUrl ?? url).trim()
    if (!normalized) {
      setUrlError('Enter a URL like https://yoursite.com')
      return
    }

    normalized = normalized.replace(/\/+$/, '')

    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = 'https://' + normalized
    }

    try {
      new URL(normalized)
    } catch {
      setUrlError('Enter a valid URL like https://yoursite.com')
      return
    }

    if (normalized.includes('localhost') || normalized.includes('127.0.0.1') || normalized.includes('0.0.0.0')) {
      setUrlError('FixFlags can only check publicly accessible URLs')
      return
    }

    setLoading(true)
    try {
      const params = new URLSearchParams(window.location.search)
      const res = await fetch('/api/checks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: normalized,
          source: auditSource,
          utmSource: params.get('utm_source') ?? undefined,
          utmMedium: params.get('utm_medium') ?? undefined,
          utmCampaign: params.get('utm_campaign') ?? undefined,
        }),
      })

      if (!res.ok) {
        const parsed = await parseApiErrorResponse(res)
        if (
          res.status === 402 ||
          (res.status === 401 && parsed.code === 'AUTH_REQUIRED')
        ) {
          setLimitGate(parsed)
        } else if (res.status === 429 || parsed.code === 'RATE_LIMITED') {
          setQueueHold({
            estimatedWaitSeconds: parsed.estimatedWaitSeconds ?? 60,
          })
        } else {
          toast.error(parsed.message)
        }
        return
      }

      const data = await res.json()
      const reportId = data.reportId as string
      trackEvent('started_audit', {
        source: auditSource,
        is_logged_in: data.isLoggedIn ?? false,
      })
      setActiveAudit({
        auditId: reportId,
        url: normalized,
        queuePosition: data.queuePosition,
        estimatedWaitSeconds: data.estimatedWaitSeconds,
        scheduledStartAt: data.scheduledStartAt,
        queueReason: data.queueReason,
      })
      router.push(`/report/${reportId}`)
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await submitUrl()
  }

  async function handleTrySample() {
    setUrl(SAMPLE_AUDIT_URL)
    await submitUrl(SAMPLE_AUDIT_URL)
  }

  const isLanding = variant === 'landing'
  const auditSource = source ?? (isLanding ? 'homepage' : 'dashboard')
  const describedBy = cn(isLanding && !urlError && helperId, urlError && errorId) || undefined

  const fieldHeightClass = 'h-12 min-h-12'
  const fieldHeightInputClass = 'h-12 min-h-12 py-0 leading-none'

  return (
    <div className={cn('flex w-full flex-col gap-3', isLanding ? 'max-w-2xl mx-auto' : 'max-w-2xl')}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        {isLanding ? (
          <InputGroup>
            <label htmlFor={inputId} className="sr-only">
              Website URL
            </label>
            <InputGroupInput
              id={inputId}
              name="url"
              type="text"
              inputMode="url"
              autoComplete="url"
              placeholder={HERO.urlPlaceholder}
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                setUrlError('')
              }}
              disabled={loading}
              aria-invalid={Boolean(urlError)}
              aria-describedby={describedBy}
            />
            <Button
              type="submit"
              variant="gradient"
              size="lg"
              disabled={loading}
              className={cn(
                fieldHeightClass,
                'w-full shrink-0 gap-2 px-5 text-base font-semibold sm:w-auto sm:min-w-[10.5rem] sm:px-6'
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking…
                </>
              ) : (
                <>
                  {HERO.primaryCta}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </InputGroup>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor={inputId} className="sr-only">
              Website URL
            </label>
            <Input
              id={inputId}
              name="url"
              type="text"
              inputMode="url"
              autoComplete="url"
              placeholder="https://yoursite.com"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                setUrlError('')
              }}
              className={cn(fieldHeightInputClass, 'flex-1 text-base')}
              disabled={loading}
              aria-invalid={Boolean(urlError)}
              aria-describedby={urlError ? errorId : undefined}
            />
            <Button
              type="submit"
              size="lg"
              disabled={loading}
              className={cn(
                fieldHeightClass,
                'w-full shrink-0 gap-2 px-6 sm:w-auto'
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking…
                </>
              ) : (
                <>
                  {HERO.primaryCta}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        )}
        {urlError && (
          <p id={errorId} role="alert" className="text-xs text-destructive">
            {urlError}
          </p>
        )}
        {isLanding && !urlError ? (
          <p id={helperId} className="px-1 text-center text-xs text-muted-foreground sm:text-left">
            {HERO.urlHelper}
          </p>
        ) : null}
      </form>

      {!isLanding ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={loading}
          onClick={handleTrySample}
          className="self-start px-0 text-sm text-muted-foreground hover:text-foreground"
        >
          {HERO.trySampleCta}
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      ) : null}

      {queueHold && (
        <QueuePosition
          estimatedSeconds={queueHold.estimatedWaitSeconds}
          queueReason="rate_limit"
        />
      )}

      {limitGate && (
        <AuditLimitGate
          message={limitGate.message}
          code={limitGate.code}
          action={limitGate.action}
          onDismiss={() => setLimitGate(null)}
        />
      )}
    </div>
  )
}
