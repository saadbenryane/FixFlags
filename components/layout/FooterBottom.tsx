'use client'

import { FooterThemeToggle } from '@/components/layout/FooterThemeToggle'
import { CookiePreferencesButton } from '@/components/analytics/CookiePreferencesButton'

export function FooterBottom({
  year,
  brandName,
  category,
}: {
  year: number
  brandName: string
  category: string
}) {
  return (
    <div className="mt-10 space-y-8 lg:mt-8">
      <div className="grid min-w-0 items-center justify-items-center gap-2 text-center lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-6">
        <p className="text-2xs leading-relaxed text-muted-foreground lg:justify-self-start lg:whitespace-nowrap lg:text-left">
          © {year} {brandName}
        </p>
        <p className="min-w-0 text-2xs leading-relaxed text-muted-foreground lg:whitespace-nowrap">
          {category}
        </p>
        <div className="flex min-w-0 flex-wrap items-center justify-center gap-3 lg:justify-self-end lg:justify-end">
          <CookiePreferencesButton className="min-h-11 text-2xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring" />
          <FooterThemeToggle />
        </div>
      </div>
    </div>
  )
}
