'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { HELP_CENTER, SUPPORT_CHAT } from '@/lib/marketing/copy'
import { useOptionalSupportContext } from '@/components/live-support/SupportProvider'

/** Secondary CTAs: view help article + open chat. */
export function HelpSupportActions({
  helpHref,
  articleTitle,
  size = 'sm',
  className,
}: {
  helpHref: string
  articleTitle?: string
  size?: 'sm' | 'default'
  className?: string
}) {
  const support = useOptionalSupportContext()

  function openChat() {
    support?.openSupportChat({
      pageUrl: typeof window !== 'undefined' ? window.location.href : undefined,
      prefill: articleTitle ? `${SUPPORT_CHAT.prefillPrefix} ${articleTitle}` : undefined,
    })
  }

  return (
    <div className={className ? `flex flex-wrap gap-2 ${className}` : 'flex flex-wrap gap-2'}>
      <Button asChild variant="outline" size={size}>
        <Link href={helpHref as Route}>{HELP_CENTER.viewHelpCta}</Link>
      </Button>
      <Button type="button" variant="ghost" size={size} onClick={openChat}>
        {HELP_CENTER.askSupportCta}
      </Button>
    </div>
  )
}
