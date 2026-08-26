'use client'

import { Button } from '@/components/ui/button'
import { useMe } from '@/hooks/useMe'
import { AvatarMenu } from '@/components/layout/AvatarMenu'
import { AUTH } from '@/lib/marketing/copy/auth'
import { useReportAuthGate } from '@/components/auth/ReportAuthGate'
import { ReportMobileNav } from '@/components/layout/ReportAppRail'

/** Slim report header account slot: Sign up CTA or avatar. No second Review CTA. */
export function ReportHeaderAuth() {
  const { user } = useMe()
  const gate = useReportAuthGate()

  if (!user) {
    return (
      <div className="flex items-center gap-1 sm:gap-2">
        <ReportMobileNav />
        <Button
          variant="brand"
          size="sm"
          className="rounded-[var(--radius-control)] px-4 font-semibold"
          onClick={() => gate?.open({ reason: 'create-account' })}
        >
          {AUTH.reportHeader.cta}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <ReportMobileNav />
      <AvatarMenu user={user} />
    </div>
  )
}
