declare global {
  interface Window {
    gtag: (
      command: 'event' | 'config' | 'set',
      target: string,
      params?: Record<string, unknown>
    ) => void
    fbq: (...args: unknown[]) => void
  }
}

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
  const sendTo = conversionLabel ? `${adsId}/${conversionLabel}` : adsId
  try {
    if (params?.email) {
      window.gtag('set', 'user_data', { email: params.email })
    }
    window.gtag('event', 'conversion', { send_to: sendTo })
  } catch {
    /* ads tag unavailable */
  }
}

export function fireMetaPixelEvent(
  event: 'CompleteRegistration' | 'Lead' | 'ViewContent',
  params?: Record<string, unknown>
): void {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return
  try {
    window.fbq('track', event, params)
  } catch {
    /* pixel unavailable */
  }
}
