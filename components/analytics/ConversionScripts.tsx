'use client'

import { InteractiveButton } from '@/components/ui/interactive-controls'
import { usePathname } from 'next/navigation'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useFixedBottomNotice } from '@/components/system/useFixedBottomNotice'
import { ChevronDown } from 'lucide-react'
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
  type AnalyticsConsent,
  readAnalyticsConsent,
  writeAnalyticsConsent,
} from '@/lib/analytics/consent'
import { ANALYTICS_CONSENT_COPY } from '@/lib/marketing/copy/legal'
import { getGoogleAnalyticsId, initializeGoogleTag } from '@/lib/analytics/gtag'
import { ANALYTICS_JOURNEY_STORAGE_KEY } from '@/lib/analytics/journey-id'
import styles from './ConversionScripts.module.css'

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

    const existingRaw = document.cookie.match(
      new RegExp(`(?:^|; )${CLICK_IDS_COOKIE}=([^;]+)`),
    )?.[1]
    const existing = parseClickIds(existingRaw ? decodeURIComponent(existingRaw) : null)
    const value = serializeClickIds({
      gclid: gclid ?? existing.gclid,
      fbclid: fbclid ?? existing.fbclid,
    })
    document.cookie = `${CLICK_IDS_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=${CLICK_IDS_MAX_AGE}; SameSite=Lax`
  }, [enabled])
}

export function ConversionScripts() {
  const pathname = usePathname(),
    privateAdmin = pathname === '/admin' || pathname?.startsWith('/admin/') === true
  const gaId = getGoogleAnalyticsId()
  const adsId = getGoogleAdsId()
  const pixelId = getMetaPixelId()
  // The neutral notice is present in the first HTML. The pre-paint preference
  // bootstrap suppresses it for returning visitors until hydration resolves.
  const [consent, setConsent] = useState<AnalyticsConsent | null>()
  const [showPreferences, setShowPreferences] = useState(false)
  const preferencesOpener = useRef<HTMLElement | null>(null)

  useLayoutEffect(() => {
    if (gaId) (window as unknown as Record<string, unknown>)[`ga-disable-${gaId}`] = privateAdmin
    window.fbq?.(
      'consent',
      privateAdmin ? 'revoke' : readAnalyticsConsent() === 'granted' ? 'grant' : 'revoke',
    )
  }, [privateAdmin, gaId])
  useEffect(() => {
    if (privateAdmin) return
    initializeGoogleTag()
    setConsent(readAnalyticsConsent())
    const onConsent = (event: Event) => {
      initializeGoogleTag()
      const choice = (event as CustomEvent<AnalyticsConsent>).detail
      window.fbq?.('consent', choice === 'granted' ? 'grant' : 'revoke')
      if (choice === 'denied') {
        document.cookie = `${CLICK_IDS_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
        try {
          window.sessionStorage.removeItem(ANALYTICS_JOURNEY_STORAGE_KEY)
        } catch {
          // Storage can be unavailable in privacy-restricted browsers.
        }
      }
      setConsent(choice)
      setShowPreferences(false)
      preferencesOpener.current?.focus({ preventScroll: true })
      preferencesOpener.current = null
    }
    const onPreferences = () => {
      preferencesOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setShowPreferences(true)
    }
    window.addEventListener(ANALYTICS_CONSENT_EVENT, onConsent)
    window.addEventListener(ANALYTICS_PREFERENCES_EVENT, onPreferences)
    return () => {
      window.removeEventListener(ANALYTICS_CONSENT_EVENT, onConsent)
      window.removeEventListener(ANALYTICS_PREFERENCES_EVENT, onPreferences)
    }
  }, [privateAdmin])

  const enabled = !privateAdmin && consent === 'granted'
  const asking = !privateAdmin && (consent == null || showPreferences)
  const notice = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!showPreferences) return
    const choice = notice.current?.querySelector<HTMLButtonElement>('button')
    choice?.focus({ preventScroll: true })
    choice?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
  }, [showPreferences])
  useFixedBottomNotice(notice, asking, 10)
  useCaptureClickIds(enabled)

  const gtagId = gaId || (enabled ? adsId : undefined)

  if (privateAdmin) return null
  return (
    <>
      {consent !== undefined && gtagId ? (
        <Script
          id="google-tag"
          src={`https://www.googletagmanager.com/gtag/js?id=${gtagId}`}
          strategy="afterInteractive"
        />
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
          ref={notice}
          data-fixed-bottom-notice="analytics"
          data-consent-unresolved={consent === undefined ? '' : undefined}
          role="dialog"
          aria-label={ANALYTICS_CONSENT_COPY.title}
          aria-describedby="analytics-consent-description"
          className={styles.notice}
        >
          <details className={styles.details}>
            <summary>{ANALYTICS_CONSENT_COPY.compactTitle}<ChevronDown size={14} aria-hidden /></summary>
            <p id="analytics-consent-description">{ANALYTICS_CONSENT_COPY.body}</p>
          </details>
          <div className={styles.actions}>
            <InteractiveButton
              type="button"
              className="min-h-11 rounded-full bg-foreground px-4 text-xs font-semibold text-background"
              onClick={() => writeAnalyticsConsent('granted')}
            >
              {ANALYTICS_CONSENT_COPY.allow}
            </InteractiveButton>
            <InteractiveButton
              type="button"
              className="min-h-11 rounded-full border border-border px-4 text-xs font-semibold text-foreground"
              onClick={() => writeAnalyticsConsent('denied')}
            >
              {ANALYTICS_CONSENT_COPY.necessaryOnly}
            </InteractiveButton>
          </div>
        </div>
      ) : null}
    </>
  )
}
