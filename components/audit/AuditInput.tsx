'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupInput } from '@/components/ui/input-group'
import { ArrowRight, Loader2 } from 'lucide-react'
import { HERO, AUDIT_PROGRESS, OFFER } from '@/lib/marketing/copy'
import { SAMPLE_AUDIT_URL } from '@/lib/marketing/display-meta'
import { cn } from '@/lib/utils'
import { trackEvent } from '@/lib/analytics/events'
import { useMe } from '@/hooks/useMe'
import {
  startScanWithHandoff,
  trackStartedAudit,
} from '@/lib/audit/start-scan-handoff'
import { useScanHandoffState } from '@/lib/audit/scan-handoff-store'

const AUTOSTART_DONE_KEY = 'ff:autostart-url'

export function AuditInput({
  variant = 'default',
  source,
  idSuffix = '',
  initialUrl = '',
  autoStart = false,
  ctaPlacement,
}: {
  variant?: 'default' | 'landing'
  /** Audit attribution source sent to POST /api/checks (defaults from variant). */
  source?: 'homepage' | 'dashboard' | 'report' | 'tool_page' | 'issue_page' | 'benchmark_page'
  idSuffix?: string
  initialUrl?: string
  /** When true and initialUrl is set, submit once on mount (post-signup handoff). */
  autoStart?: boolean
  /** Distinguishes hero vs final CTA on the landing page for funnel attribution. */
  ctaPlacement?: 'hero' | 'final'
}) {
  const inputId = `audit-url${idSuffix}`
  const errorId = `audit-url-error${idSuffix}`
  const router = useRouter()
  const { user } = useMe()
  const handoff = useScanHandoffState()
  const [url, setUrl] = useState(initialUrl)
  const [loading, setLoading] = useState(false)
  const [urlError, setUrlError] = useState('')
  const autoStartedRef = useRef(false)
  const resolvedPlacement = ctaPlacement ?? (variant === 'landing' ? 'hero' : undefined)
  const isLanding = variant === 'landing'
  const auditSource = source ?? (isLanding ? 'homepage' : 'dashboard')

  async function submitUrl(inputUrl?: string) {
    setUrlError('')

    const failValidation = (reason: string, message: string) => {
      setUrlError(message)
      trackEvent('scan_validation_failed', {
        reason,
        cta_placement: resolvedPlacement ?? (isLanding ? 'hero' : 'dashboard'),
      })
    }

    let normalized = (inputUrl ?? url).trim()
    if (!normalized) {
      failValidation('empty', 'Enter a URL like https://yoursite.com')
      return
    }

    normalized = normalized.replace(/\/+$/, '')

    const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(normalized)
    if (!hasScheme) {
      normalized = 'https://' + normalized
    }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(normalized)
    } catch {
      failValidation('malformed', 'Enter a valid URL like https://yoursite.com')
      return
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      failValidation('scheme', 'Only http:// and https:// URLs can be checked')
      return
    }

    if (normalized.includes('localhost') || normalized.includes('127.0.0.1') || normalized.includes('0.0.0.0')) {
      failValidation('localhost', 'FixFlags can only check publicly accessible URLs')
      return
    }

    setUrl(normalized)
    setLoading(true)
    const params = new URLSearchParams(window.location.search)
    const result = await startScanWithHandoff(router, {
      url: normalized,
      body: {
        url: normalized,
        source: auditSource,
        utmSource: params.get('utm_source') ?? undefined,
        utmMedium: params.get('utm_medium') ?? undefined,
        utmCampaign: params.get('utm_campaign') ?? undefined,
        gclid: params.get('gclid') ?? undefined,
        fbclid: params.get('fbclid') ?? undefined,
      },
      limitFrom: resolvedPlacement,
      onStarted: (data) => {
        const isLoggedIn =
          typeof data.isLoggedIn === 'boolean' ? data.isLoggedIn : Boolean(user)
        trackStartedAudit({
          source: auditSource,
          isLoggedIn,
          ctaPlacement: resolvedPlacement ?? (isLanding ? 'hero' : 'dashboard'),
          utmSource: params.get('utm_source'),
          utmCampaign: params.get('utm_campaign'),
        })
      },
    })
    if (!result.ok) setLoading(false)
  }

  useEffect(() => {
    if (!autoStart || !initialUrl || autoStartedRef.current) return
    autoStartedRef.current = true
    try {
      if (sessionStorage.getItem(AUTOSTART_DONE_KEY) === initialUrl) return
      sessionStorage.setItem(AUTOSTART_DONE_KEY, initialUrl)
    } catch {
      // sessionStorage unavailable: fall through and submit once for this mount.
    }
    void submitUrl(initialUrl)
    // Intentionally one-shot on mount when handoff URL is present.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, initialUrl])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await submitUrl()
  }

  async function handleTrySample() {
    setUrl(SAMPLE_AUDIT_URL)
    await submitUrl(SAMPLE_AUDIT_URL)
  }

  function handleLandingTrySample() {
    trackEvent('clicked_sample_cta', { placement: 'hero' })
    const target = document.getElementById('sample-review')
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    router.push('/#sample-review')
  }

  const describedBy = urlError ? errorId : undefined
  const busy = loading || Boolean(handoff.url)

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
              onFocus={() => {
                if (resolvedPlacement === 'hero' || resolvedPlacement === 'final') {
                  trackEvent('audit_intent', {
                    cta_placement: resolvedPlacement,
                    from: resolvedPlacement,
                  })
                }
              }}
              onChange={(e) => {
                setUrl(e.target.value)
                setUrlError('')
              }}
              disabled={busy}
              aria-invalid={Boolean(urlError)}
              aria-describedby={describedBy}
            />
            <Button
              type="submit"
              variant="default"
              size="lg"
              disabled={busy}
              className={cn(
                fieldHeightClass,
                'w-full shrink-0 gap-2 px-5 text-base font-semibold sm:w-auto sm:min-w-[10.5rem] sm:px-6'
              )}
            >
              {busy ? (
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
              disabled={busy}
              aria-invalid={Boolean(urlError)}
              aria-describedby={urlError ? errorId : undefined}
            />
            <Button
              type="submit"
              size="lg"
              disabled={busy}
              className={cn(
                fieldHeightClass,
                'w-full shrink-0 gap-2 px-6 sm:w-auto'
              )}
            >
              {busy ? (
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

      {isLanding && (
        <p className="text-center text-2xs leading-relaxed text-muted-foreground/90">
          {OFFER.short}
        </p>
      )}

      <div className={cn('flex flex-col gap-1', isLanding ? 'items-center' : 'items-start')}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={isLanding ? handleLandingTrySample : handleTrySample}
          className="px-0 text-sm text-muted-foreground hover:text-foreground"
        >
          {HERO.trySampleCta}
          <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
