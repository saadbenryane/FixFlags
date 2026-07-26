'use client'

import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { OfflineNotice } from '@/components/system/OfflineNotice'
import { MeProvider, type MeUser } from '@/hooks/useMe'

export function Providers({
  children,
  initialUser,
}: {
  children: React.ReactNode
  initialUser?: MeUser | null
}) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <MeProvider initialUser={initialUser}>
        {children}
        <OfflineNotice />
        <Toaster richColors position="bottom-right" />
      </MeProvider>
    </ThemeProvider>
  )
}
