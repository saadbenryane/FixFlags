import type { Metadata } from 'next'
import { Fraunces, IBM_Plex_Mono, Source_Sans_3 } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'
import { ThemeProvider } from '@/components/theme-provider'
import { BRAND, HERO, SITE_URL } from '@/lib/marketing/copy'
import { OfflineNotice } from '@/components/system/OfflineNotice'

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
})

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  axes: ['SOFT', 'WONK', 'opsz'],
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: `${BRAND.name} - ${HERO.headline}`,
  description: HERO.subhead,
  openGraph: {
    title: BRAND.name,
    description: HERO.subhead,
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sourceSans.variable} ${fraunces.variable} ${ibmPlexMono.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <a
            href="#main-content"
            className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-full bg-background px-4 py-3 text-sm font-semibold shadow-lg transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            Skip to content
          </a>
          {children}
          <OfflineNotice />
          <Toaster richColors position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}
