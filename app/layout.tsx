import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: 'QualityOS — Your agent built it. QualityOS checks if it works.',
  description: 'Run a quality audit on any website. Get evidence-backed issues across 7 areas. Copy fix prompts straight into your AI agent. Re-check after fixes.',
  openGraph: {
    title: 'QualityOS',
    description: 'Your agent built it. QualityOS checks if it works.',
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
      <body className="antialiased">
        {children}
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  )
}
