'use client'

import { usePathname } from 'next/navigation'
import { FooterNewsletter } from '@/components/layout/FooterNewsletter'
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
  const homepage = usePathname() === '/'

  return (
    <div className={`mt-10 grid gap-7 border-t border-border/55 pt-7 lg:mt-8 lg:items-start lg:gap-10 lg:pt-8 ${homepage ? 'lg:grid-cols-1' : 'lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)]'}`}>
      <div className="space-y-2 lg:pr-7">
        <p className="text-2xs leading-relaxed text-muted-foreground">
          © {year} {brandName}
        </p>
        <p className="text-2xs leading-relaxed text-muted-foreground">
          {category}
        </p>
        <FooterThemeToggle />
        <CookiePreferencesButton className="min-h-11 text-2xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring" />
      </div>

      {!homepage ? <FooterNewsletter className="lg:justify-self-end" /> : null}
    </div>
  )
}
