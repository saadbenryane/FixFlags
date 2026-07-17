'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupInput } from '@/components/ui/input-group'
import { ArrowRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { HERO, AUDIT_PROGRESS } from '@/lib/marketing/copy'
import { SAMPLE_AUDIT_URL } from '@/lib/marketing/display-meta'
import { parseApiErrorResponse } from '@/lib/api/parse-error'
import { AuditLimitGate } from '@/components/audit/AuditLimitGate'
import { setActiveAudit } from '@/lib/audit/active-audit'
import { cn } from '@/lib/utils'
import { trackEvent } from '@/lib/analytics/events'
import { useMe } from '@/hooks/useMe'

export function AuditInput({
  variant = 'default',
  source,
  idSuffix = '',
  initialUrl = '',
  ctaPlacement,
}: {
  variant?: 'default' | 'landing'
  /** Audit attribution source sent to POST /api/checks (defaults from variant). */
  source?: 'homepage' | 'dashboard' | 'report' | 'tool_page' | 'issue_page' | 'benchmark_page'
  idSuffix?: string
  initialUrl?: string
  /** Distinguishes hero vs final CTA on the landing page for funnel attribution. */
  ctaPlacement?: 'hero' | 'final'
}) {
  const inputId = `audit-url${idSuffix}`
  const errorId = `audit-url-error${idSuffix}`
  const router = useRouter()
  const { user, isLoading: authLoading } = useMe()
  const [url, setUrl] = useState(initialUrl)
  const [loading, setLoading] = useState(false)
  const [urlError, setUrlError] = useState('')
  const [limitGate, setLimitGate] = useState<{
    message: string
    code?: string
    action?: string
  } | null>(null)
  const resolvedPlacement = ctaPlacement ?? (variant === 'landing' ? 'hero' : undefined)
  const funnelFrom = resolvedPlacement === 'final' ? 'final' : 'hero'

  async function submitUrl(inputUrl?: string, isSample = false) {
    setUrlError('')
    setLimitGate(null)

    let normalized = (inputUrl ?? url).trim()
    if (!normalized) {
      setUrlError('Enter a URL like https://yoursite.com')
      return
    }

    normalized = normalized.replace(/\/+$/, '')

    // Only prepend https:// when there's no scheme at all. Blindly prepending
    // whenever the string doesn't start with http(s):// mangled other schemes
    // (e.g. "ftp://x.com" became "https://ftp://x.com", parsed as host "ftp" with
    // no error shown) into a URL that "successfully" parsed but pointed nowhere
    // real, so bad input silently reached the backend instead of failing fast.
    const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(normalized)
    if (!hasScheme) {
      normalized = 'https://' + normalized
    }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(normalized)
    } catch {
      setUrlError('Enter a valid URL like https://yoursite.com')
      return
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      setUrlError('Only http:// and https:// URLs can be checked')
      return
    }

    if (normalized.includes('localhost') || normalized.includes('127.0.0.1') || normalized.includes('0.0.0.0')) {
      setUrlError('FixFlags can only check publicly accessible URLs')
      return
    }

    if (isLanding && !authLoading && !user && !isSample) {
      const nextParams = new URLSearchParams({ url: normalized })
      const signUpParams = new URLSearchParams({
        next: `/dashboard?${nextParams.toString()}`,
        from: funnelFrom,
      })
      trackEvent('audit_intent', {
        cta_placement: funnelFrom,
        from: funnelFrom,
      })

      router.push(`/sign-up?${signUpParams.toString()}`)
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
          gclid: params.get('gclid') ?? undefined,
          fbclid: params.get('fbclid') ?? undefined,
        }),
      })

      if (!res.ok) {
        const parsed = await parseApiErrorResponse(res)
        if (
          res.status === 402 ||
          (res.status === 401 && parsed.code === 'AUTH_REQUIRED')
        ) {
          setLimitGate(parsed)
        } else {
          toast.error(parsed.message)
        }
        return
      }

      const data = await res.json()
      const reportId = typeof data.reportId === 'string' ? data.reportId : ''
      trackEvent('started_audit', {
        source: auditSource,
        is_logged_in: data.isLoggedIn ?? false,
        cta_placement: resolvedPlacement ?? (isLanding ? 'hero' : 'dashboard'),
      })
      if (reportId) {
        setActiveAudit({
          auditId: reportId,
          url: normalized,
        })
      }
      router.push(reportId ? `/report/${reportId}` : '/dashboard')
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
    await submitUrl(SAMPLE_AUDIT_URL, true)
  }

  /** Scroll to the inline sample explorer -- no scan, no account. */
  function handleLandingTrySample() {
    trackEvent('clicked_sample_cta', { placement: 'hero' })
    const target = document.getElementById('sample-review')
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    router.push('/#sample-review')
  }

  const isLanding = variant === 'landing'
  const auditSource = source ?? (isLanding ? 'homepage' : 'dashboard')
  const describedBy = urlError ? errorId : undefined

  const fieldHeightClass = 'h-12 min-h-12'
  const fieldHeightInputClass = 'h-12 min-h-12 py-0 leading-none'
  const landingDisabled = loading || (isLanding && authLoading)

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
              disabled={landingDisabled}
              aria-invalid={Boolean(urlError)}
              aria-describedby={describedBy}
            />
            <Button
              type="submit"
              variant="default"
              size="lg"
              disabled={landingDisabled}
              className={cn(
                fieldHeightClass,
                'w-full shrink-0 gap-2 px-5 text-base font-semibold sm:w-auto sm:min-w-[10.5rem] sm:px-6'
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {AUDIT_PROGRESS.submitLoading}
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
                  {AUDIT_PROGRESS.submitLoading}
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
      </form>

      <div className={cn('flex flex-col gap-1', isLanding ? 'items-center' : 'items-start')}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={loading}
          onClick={isLanding ? handleLandingTrySample : handleTrySample}
          className="px-0 text-sm text-muted-foreground hover:text-foreground"
        >
          {HERO.trySampleCta}
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
        {isLanding && (
          <p className="text-[11px] text-muted-foreground/80">{HERO.trySampleHint}</p>
        )}
      </div>

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
