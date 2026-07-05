import type { Metadata } from 'next'
import { GoogleAnalytics } from '@next/third-parties/google'
import { ConversionScripts } from '@/components/analytics/ConversionScripts'
import '@/lib/design/tokens.css'
import './globals.css'
import { Providers } from '@/components/providers'
import { BRAND, HERO, SITE_URL } from '@/lib/marketing/copy'
import { DEFAULT_OG_IMAGE } from '@/lib/marketing/metadata'
import { fontVariables } from '@/lib/design/fonts'

const googleSiteVerification = process.env.GOOGLE_SITE_VERIFICATION

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: `${BRAND.name} - ${HERO.headline}`,
  description: HERO.subhead,
  ...(googleSiteVerification
    ? { verification: { google: googleSiteVerification } }
    : {}),
  manifest: '/manifest.webmanifest',
  openGraph: {
    title: BRAND.name,
    description: HERO.subhead,
    type: 'website',
    url: SITE_URL,
    siteName: BRAND.name,
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: BRAND.name,
    description: HERO.subhead,
    images: [DEFAULT_OG_IMAGE.url],
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon', type: 'image/png', sizes: '32x32' },
    ],
    apple: '/apple-icon',
  },
  other: {
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${fontVariables} font-sans antialiased`}>
        <Providers>
          <a
            href="#main-content"
            className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-full bg-[var(--glass-bg-elevated)] px-4 py-3 text-sm font-semibold shadow-lg backdrop-blur-md transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            Skip to content
          </a>
          {children}
        </Providers>
        {gaId ? <GoogleAnalytics gaId={gaId} /> : null}
        <ConversionScripts />
      </body>
    </html>
  )
}
