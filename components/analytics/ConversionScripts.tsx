'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Script from 'next/script'
import { getGoogleAdsId, getMetaPixelId } from '@/lib/analytics/ad-conversions'
import {
  CLICK_IDS_COOKIE,
  CLICK_IDS_MAX_AGE,
  parseClickIds,
  serializeClickIds,
} from '@/lib/analytics/click-ids'
import {
  ANALYTICS_CONSENT_EVENT,
  ANALYTICS_PREFERENCES_EVENT,
  CONSENT_CLEARANCE_PX,
  type AnalyticsConsent,
  readAnalyticsConsent,
  writeAnalyticsConsent,
} from '@/lib/analytics/consent'
import { ANALYTICS_CONSENT_COPY } from '@/lib/marketing/copy'

const gaId = process.env.NEXT_PUBLIC_GA_ID

/**
 * Capture ad click ids (gclid/fbclid) from the landing URL into a first-party
 * cookie so the server-side signup hook can attribute the account to the click,
 * even for visitors who sign up without running a scan.
 */
function useCaptureClickIds(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const params = new URLSearchParams(window.location.search)
    const gclid = params.get('gclid')
    const fbclid = params.get('fbclid')
    if (!gclid && !fbclid) return

    const existingRaw = document.cookie
      .match(new RegExp(`(?:^|; )${CLICK_IDS_COOKIE}=([^;]+)`))?.[1]
    const existing = parseClickIds(existingRaw ? decodeURIComponent(existingRaw) : null)
    const value = serializeClickIds({
      gclid: gclid ?? existing.gclid,
      fbclid: fbclid ?? existing.fbclid,
    })
    document.cookie = `${CLICK_IDS_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=${CLICK_IDS_MAX_AGE}; SameSite=Lax`
  }, [enabled])
}

export function ConversionScripts() {
  const adsId = getGoogleAdsId()
  const pixelId = getMetaPixelId()
  const [consent, setConsent] = useState<AnalyticsConsent | null>(null)
  const [showPreferences, setShowPreferences] = useState(false)

  useEffect(() => {
    setConsent(readAnalyticsConsent())
    const onConsent = (event: Event) => {
      setConsent((event as CustomEvent<AnalyticsConsent>).detail)
      setShowPreferences(false)
    }
    const onPreferences = () => setShowPreferences(true)
    window.addEventListener(ANALYTICS_CONSENT_EVENT, onConsent)
    window.addEventListener(ANALYTICS_PREFERENCES_EVENT, onPreferences)
    return () => {
      window.removeEventListener(ANALYTICS_CONSENT_EVENT, onConsent)
      window.removeEventListener(ANALYTICS_PREFERENCES_EVENT, onPreferences)
    }
  }, [])

  const enabled = consent === 'granted'
  const asking = consent === null || showPreferences
  const dialogRef = useRef<HTMLDivElement>(null)
  useCaptureClickIds(enabled)

  useLayoutEffect(() => {
    const root = document.documentElement
    if (!asking) {
      root.style.paddingTop = ''
      return
    }
    const apply = () => {
      const node = dialogRef.current
      const bottom = node ? node.getBoundingClientRect().bottom : 0
      root.style.paddingTop = `${Math.ceil(Math.max(bottom + 16, CONSENT_CLEARANCE_PX))}px`
    }
    apply()
    window.addEventListener('resize', apply)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(apply)
    if (dialogRef.current && observer) observer.observe(dialogRef.current)
    return () => {
      window.removeEventListener('resize', apply)
      observer?.disconnect()
      root.style.paddingTop = ''
    }
  }, [asking])

  const gtagId = gaId || adsId

  return (
    <>
      {enabled && gtagId ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gtagId}`}
            strategy="afterInteractive"
          />
          <Script id="gtag-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${gtagId}');
              ${adsId && adsId !== gaId ? `gtag('config', '${adsId}');` : ''}
            `}
          </Script>
        </>
      ) : null}
      {enabled && pixelId ? (
        <Script id="meta-pixel" strategy="lazyOnload">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${pixelId}');
            fbq('track', 'PageView');
          `}
        </Script>
      ) : null}
      {asking ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-label={ANALYTICS_CONSENT_COPY.title}
          className="fixed inset-x-3 top-3 z-40 mx-auto max-h-[40dvh] w-[calc(100%-1.5rem)] max-w-xl overflow-y-auto overflow-x-hidden rounded-2xl border border-border bg-background/95 p-4 shadow-card backdrop-blur-md sm:p-5"
        >
          <p className="text-sm font-semibold text-foreground">{ANALYTICS_CONSENT_COPY.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {ANALYTICS_CONSENT_COPY.body}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="min-h-11 rounded-full bg-foreground px-4 text-xs font-semibold text-background"
              onClick={() => writeAnalyticsConsent('granted')}
            >
              {ANALYTICS_CONSENT_COPY.allow}
            </button>
            <button
              type="button"
              className="min-h-11 rounded-full border border-border px-4 text-xs font-semibold text-foreground"
              onClick={() => writeAnalyticsConsent('denied')}
            >
              {ANALYTICS_CONSENT_COPY.necessaryOnly}
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
