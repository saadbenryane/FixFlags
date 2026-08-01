export function getGoogleAdsId(): string | undefined {
  return process.env.NEXT_PUBLIC_GOOGLE_ADS_ID
}

export function getGoogleAdsSignupLabel(): string | undefined {
  return process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL
}

export function getMetaPixelId(): string | undefined {
  return process.env.NEXT_PUBLIC_META_PIXEL_ID
}

export function fireGoogleAdsConversion(
  conversionLabel: string | undefined,
  params?: { email?: string }
): void {
  const adsId = getGoogleAdsId()
  if (typeof window === 'undefined' || !adsId || !window.gtag) return
  // A conversion needs a specific label ("AW-XXX/label"). Firing at the bare
  // account id silently mis-attributes, so fail loud in dev and skip instead.
  if (!conversionLabel) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[ads] NEXT_PUBLIC_GOOGLE_ADS_ID is set but no conversion label was provided; skipping conversion.'
      )
    }
    return
  }
  try {
    if (params?.email) {
      // Client-side Enhanced Conversions: gtag hashes the email for match.
      window.gtag('set', 'user_data', { email: params.email })
    }
    window.gtag('event', 'conversion', { send_to: `${adsId}/${conversionLabel}` })
  } catch {
    /* ads tag unavailable */
  }
}

export function fireMetaPixelEvent(
  event: 'CompleteRegistration' | 'Lead' | 'ViewContent',
  params?: Record<string, unknown>,
  eventID?: string
): void {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return
  try {
    // The 4th arg { eventID } lets Meta deduplicate this client event against
    // the server-side Conversions API event that shares the same id.
    if (eventID) {
      window.fbq('track', event, params ?? {}, { eventID })
    } else {
      window.fbq('track', event, params)
    }
  } catch {
    /* pixel unavailable */
  }
}
