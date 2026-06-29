'use client'

import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { OfflineNotice } from '@/components/system/OfflineNotice'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      {children}
      <OfflineNotice />
      <Toaster richColors position="bottom-right" />
    </ThemeProvider>
  )
}
