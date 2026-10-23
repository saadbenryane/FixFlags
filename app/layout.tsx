import { siteVerification } from '@/lib/marketing/site-verification'
import type { Metadata, Viewport } from 'next'
import '@fontsource-variable/inter/wght.css'
import '@fontsource-variable/inter-tight/wght.css'
import '@fontsource-variable/jetbrains-mono/wght.css'
import './font-fallbacks.css'
import { ConversionScripts } from '@/components/analytics/ConversionScripts'
import '@/lib/design/tokens.css'
import './globals.css'
import { Providers } from '@/components/providers'
import { BRAND, SITE_URL, SEO } from '@/lib/marketing/copy-barrel'
import { DEFAULT_OG_IMAGE } from '@/lib/marketing/metadata'
import { fontVariables } from '@/lib/design/fonts'
import { bodyFont, displayFont } from './fonts'
import { ANALYTICS_CONSENT_BOOTSTRAP } from '@/lib/analytics/consent'


export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SEO.home.title,
  description: SEO.home.description,
  verification: siteVerification(),
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
      { url: '/favicon.ico?v=20261021', sizes: '16x16 32x32 48x48' },
      { url: '/icon-32.png?v=20261021', type: 'image/png', sizes: '32x32' },
      { url: '/icon.svg?v=20261021', type: 'image/svg+xml', sizes: 'any' },
    ],
    apple: [{ url: '/apple-touch-icon-v2.png', type: 'image/png', sizes: '180x180' }],
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
  return (
    <html lang="en" className={`${bodyFont.variable} ${displayFont.variable}`} suppressHydrationWarning>
      <head>
        <link rel="describedby" href="/llms.txt" type="text/plain" />
        <script dangerouslySetInnerHTML={{ __html: ANALYTICS_CONSENT_BOOTSTRAP }} />
      </head>
      {/* Fonts are served by this deployment. Next preloads the primary text faces. */}
      <body className={`${fontVariables} font-sans antialiased`}>
        <Providers>
          <a
            href="#main-content"
            className="fixed left-4 top-4 z-skip-link -translate-y-24 rounded-full bg-[var(--glass-bg-elevated)] px-4 py-3 text-sm font-semibold shadow-card backdrop-blur-md transition-none focus:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
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
