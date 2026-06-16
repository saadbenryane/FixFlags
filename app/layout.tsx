import type { Metadata } from 'next'
import './globals.css'
import { Providers } from '@/components/providers'
import { BRAND, HERO, SITE_URL } from '@/lib/marketing/copy'
import { fontVariables } from '@/lib/design/fonts'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: `${BRAND.name} - ${HERO.headline}`,
  description: HERO.subhead,
  openGraph: {
    title: BRAND.name,
    description: HERO.subhead,
    type: 'website',
  },
  icons: {
    icon: '/icon',
    apple: '/icon',
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
    <html lang="en" suppressHydrationWarning>
      <body className={`${fontVariables} font-sans antialiased`}>
        <Providers>
          <a
            href="#main-content"
            className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-md bg-background px-4 py-3 text-sm font-semibold shadow-lg transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            Skip to content
          </a>
          {children}
        </Providers>
      </body>
    </html>
  )
}
