import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import '@fontsource-variable/inter/wght.css'
import '@fontsource-variable/inter-tight/wght.css'
import '@fontsource-variable/jetbrains-mono/wght.css'
import { ConversionScripts } from '@/components/analytics/ConversionScripts'
import '@/lib/design/tokens.css'
import './globals.css'
import { Providers } from '@/components/providers'
import { BRAND, SITE_URL, SEO } from '@/lib/marketing/copy'
import { DEFAULT_OG_IMAGE } from '@/lib/marketing/metadata'
import { fontVariables } from '@/lib/design/fonts'
import { ANALYTICS_CONSENT_COOKIE, consentPagePadding } from '@/lib/analytics/consent'

const googleSiteVerification = process.env.GOOGLE_SITE_VERIFICATION

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SEO.home.title,
  description: SEO.home.description,
  ...(googleSiteVerification
    ? { verification: { google: googleSiteVerification } }
    : {}),
  manifest: '/manifest.webmanifest',
  openGraph: {
    title: BRAND.name,
    description: SEO.home.description,
    type: 'website',
    url: SITE_URL,
    siteName: BRAND.name,
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: BRAND.name,
    description: SEO.home.description,
    images: [DEFAULT_OG_IMAGE.url],
  },
  icons: {
    icon: [
      { url: '/icon-32.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/icon-512.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: '/apple-icon.png',
  },
  other: {
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const consent = (await cookies()).get(ANALYTICS_CONSENT_COOKIE)?.value
  const reserved = consentPagePadding(consent)
  return (
    <html lang="en" suppressHydrationWarning style={reserved ? { paddingTop: reserved } : undefined}>
      {/* Fontsource assets are bundled into the build; no font network request is required. */}
      <body className={`${fontVariables} font-sans antialiased`}>
        <Providers>
          <a
            href="#main-content"
            className="fixed left-4 top-4 z-skip-link -translate-y-24 rounded-full bg-[var(--glass-bg-elevated)] px-4 py-3 text-sm font-semibold shadow-card backdrop-blur-md transition-transform focus:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            Skip to content
          </a>
          {children}
        </Providers>
        <ConversionScripts />
      </body>
    </html>
  )
}
