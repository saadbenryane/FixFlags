'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupInput } from '@/components/ui/input-group'
import { ArrowRight, Link2, Loader2 } from 'lucide-react'
import { HERO, AUDIT_PROGRESS, AUDIT_ERRORS } from '@/lib/marketing/copy'
import { URL_PLACEHOLDER } from '@/lib/marketing/copy/brand'
import { SAMPLE_AUDIT_URL } from '@/lib/marketing/display-meta'
import { cn } from '@/lib/utils'
import { trackEvent } from '@/lib/analytics/events'
import { useMe } from '@/hooks/useMe'
import {
  startScanWithHandoff,
  trackStartedAudit,
} from '@/lib/audit/start-scan-handoff'
import { AuditShell } from '@/components/layout/audit-shell'
import { AuditReportProgressive } from '@/components/audit/AuditReportProgressive'
import { ReportClaimDialog } from '@/components/auth/ReportClaimDialog'

const AUTOSTART_DONE_KEY = 'ff:autostart-url'

export function AuditInput({
  variant = 'default',
  source,
  idSuffix = '',
  initialUrl = '',
  autoStart = false,
  ctaPlacement,
  showLandingExtras = true,
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
  /** Landing-only sample CTA. */
  showLandingExtras?: boolean
}) {
  const inputId = `audit-url${idSuffix}`
  const errorId = `audit-url-error${idSuffix}`
  const router = useRouter()
  const { user } = useMe()
  const [url, setUrl] = useState(initialUrl)
  const [loading, setLoading] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [urlError, setUrlError] = useState('')
  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const [pendingUrl, setPendingUrl] = useState('')
  const autoStartedRef = useRef(false)
  const resolvedPlacement = ctaPlacement ?? (variant === 'landing' ? 'hero' : undefined)
  const isLanding = variant === 'landing'
  const auditSource = source ?? (isLanding ? 'homepage' : 'dashboard')

  useEffect(() => {
    setHydrated(true)
  }, [])

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
      failValidation('empty', AUDIT_ERRORS.urlRequired)
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
      failValidation('malformed', AUDIT_ERRORS.urlMalformed)
      return
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      failValidation('scheme', AUDIT_ERRORS.urlScheme)
      return
    }

    if (normalized.includes('localhost') || normalized.includes('127.0.0.1') || normalized.includes('0.0.0.0')) {
      failValidation('localhost', AUDIT_ERRORS.urlLocalhost)
      return
    }

    setUrl(normalized)
    setLoading(true)
    const params = new URLSearchParams(window.location.search)
    const result = await startScanWithHandoff({
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
    if (!result.ok) {
      if (result.code === 'AUTH_REQUIRED') {
        setPendingUrl(normalized)
        setAuthDialogOpen(true)
        setLoading(false)
        trackEvent('audit_limit_reached', { reason: 'anon_teaser_used' })
      } else {
        setUrlError(result.message)
        setLoading(false)
      }
    }
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

  async function handleAuthenticated() {
    setAuthDialogOpen(false)
    if (pendingUrl) {
      setLoading(true)
      setUrlError('')
      const params = new URLSearchParams(window.location.search)
      await startScanWithHandoff({
        url: pendingUrl,
        body: {
          url: pendingUrl,
          source: auditSource,
          utmSource: params.get('utm_source') ?? undefined,
          utmMedium: params.get('utm_medium') ?? undefined,
          utmCampaign: params.get('utm_campaign') ?? undefined,
          gclid: params.get('gclid') ?? undefined,
          fbclid: params.get('fbclid') ?? undefined,
        },
        onStarted: () => {
          trackStartedAudit({
            source: auditSource,
            isLoggedIn: true,
            ctaPlacement: resolvedPlacement,
            utmSource: params.get('utm_source'),
            utmCampaign: params.get('utm_campaign'),
          })
        },
      })
    }
  }

  const describedBy = urlError ? errorId : undefined
  const busy = loading
  const showHandoff = hydrated && busy && !authDialogOpen

  const fieldHeightClass = 'h-12 min-h-12'
  const fieldHeightInputClass = 'h-12 min-h-12 py-0 leading-none'

  return (
    <div className={cn('flex w-full flex-col gap-3', isLanding ? 'w-full' : 'max-w-2xl')}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        {isLanding ? (
          <InputGroup className="gap-1.5 rounded-[var(--radius-inner)] border-border/35 bg-background p-1.5 shadow-glass-deep sm:flex-row sm:items-center sm:gap-1 sm:p-1.5">
            <label htmlFor={inputId} className="sr-only">
              Website URL
            </label>
            <div className="flex min-w-0 flex-1 items-center">
              <span
                className="inline-flex shrink-0 items-center self-center pl-3.5 text-muted-foreground/80 sm:pl-4"
                aria-hidden
              >
                <Link2 className="h-5 w-5" strokeWidth={1.75} />
              </span>
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
                disabled={!hydrated || busy}
                aria-invalid={Boolean(urlError)}
                aria-describedby={describedBy}
                className="h-12 min-h-12 flex-1 pl-2.5 pr-2 text-[0.9375rem] placeholder:text-muted-foreground/70 sm:h-[3.25rem] sm:min-h-[3.25rem] sm:pl-2.5 sm:text-base"
              />
            </div>
            <Button
              type="submit"
              variant="brand"
              size="lg"
              disabled={!hydrated || busy}
              className={cn(
                'h-12 min-h-12 w-full shrink-0 gap-1.5 rounded-[var(--radius-control)] px-5 text-sm font-semibold sm:h-[3.25rem] sm:min-h-[3.25rem] sm:w-auto sm:min-w-[11.5rem] sm:gap-2 sm:px-6 sm:text-base'
              )}
            >
              {busy ? (
                <>
                  <Loader2 className="animate-spin" />
                  {AUDIT_PROGRESS.submitLoading}
                </>
              ) : (
                <>
                  {HERO.primaryCta}
                  <ArrowRight />
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
              placeholder={URL_PLACEHOLDER}
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                setUrlError('')
              }}
              className={cn(fieldHeightInputClass, 'flex-1 text-base')}
              disabled={!hydrated || busy}
              aria-invalid={Boolean(urlError)}
              aria-describedby={urlError ? errorId : undefined}
            />
            <Button
              type="submit"
              variant="brand"
              size="lg"
              disabled={!hydrated || busy}
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

      {showLandingExtras || !isLanding ? (
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
      ) : null}

      {showHandoff &&
        createPortal(
          <div
            className="fixed inset-0 z-[var(--z-modal)] bg-background"
            role="status"
            aria-live="polite"
            aria-label="Starting your review"
          >
            <AuditShell immersive>
              <AuditReportProgressive
                status="QUEUED"
                url={url}
                accessContext="anonymous_teaser"
              />
            </AuditShell>
          </div>,
          document.body
        )}

      <ReportClaimDialog
        open={authDialogOpen}
        onOpenChange={setAuthDialogOpen}
        from="scan-limit"
        onAuthenticated={handleAuthenticated}
      />
    </div>
  )
}
