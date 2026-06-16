import type { Metadata } from 'next'
import { MarketingShell } from '@/components/layout/marketing-shell'
import { BRAND } from '@/lib/marketing/copy'

export const metadata: Metadata = {
  title: BRAND.name,
  robots: { index: false, follow: false },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <MarketingShell footer="minimal">
      <div className="flex flex-1 items-center justify-center px-6 py-16 sm:py-20">{children}</div>
    </MarketingShell>
  )
}
