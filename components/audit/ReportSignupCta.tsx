'use client'

import Link from 'next/link'
import type { ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import { trackEvent } from '@/lib/analytics/events'

type ReportSignupFrom =
  | 'value_strip'
  | 'claim_guide'
  | 'sample_fix'
  | 'limit_gate'
  | 'explorer'

interface ReportSignupCtaProps {
  href: string
  from: ReportSignupFrom
  children: React.ReactNode
  variant?: ComponentProps<typeof Button>['variant']
  size?: ComponentProps<typeof Button>['size']
  className?: string
}

export function ReportSignupCta({
  href,
  from,
  children,
  variant,
  size,
  className,
}: ReportSignupCtaProps) {
  return (
    <Button asChild variant={variant} size={size} className={className}>
      <Link
        href={href}
        onClick={() => trackEvent('report_signup_cta_clicked', { from })}
      >
        {children}
      </Link>
    </Button>
  )
}

export function trackReportSignupCta(from: ReportSignupFrom) {
  trackEvent('report_signup_cta_clicked', { from })
}
