'use client'

import { useEffect } from 'react'
import Script from 'next/script'
import { getGoogleAdsId, getMetaPixelId } from '@/lib/analytics/ad-conversions'
import {
  CLICK_IDS_COOKIE,
  CLICK_IDS_MAX_AGE,
  parseClickIds,
  serializeClickIds,
} from '@/lib/analytics/click-ids'

const gaId = process.env.NEXT_PUBLIC_GA_ID

/**
 * Capture ad click ids (gclid/fbclid) from the landing URL into a first-party
 * cookie so the server-side signup hook can attribute the account to the click,
 * even for visitors who sign up without running a scan.
 */
function useCaptureClickIds() {
  useEffect(() => {
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
  }, [])
}

export function ConversionScripts() {
  const adsId = getGoogleAdsId()
  const pixelId = getMetaPixelId()
  useCaptureClickIds()

  const gtagId = gaId || adsId

  return (
    <>
      {gtagId ? (
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
      {pixelId ? (
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
    </>
  )
}
