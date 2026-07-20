'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { HELP_CENTER, SUPPORT_CHAT } from '@/lib/marketing/copy'
import { useOptionalSupportContext } from '@/components/live-support/SupportProvider'

/** Secondary CTAs: view help article + open chat. */
export function HelpSupportActions({
  helpHref,
  articleTitle,
  size = 'sm',
}: {
  helpHref: string
  articleTitle?: string
  size?: 'sm' | 'default'
}) {
  const support = useOptionalSupportContext()

  function openChat() {
    support?.openSupportChat({
      pageUrl: typeof window !== 'undefined' ? window.location.href : undefined,
      prefill: articleTitle ? `${SUPPORT_CHAT.prefillPrefix} ${articleTitle}` : undefined,
    })
  }

  return (
    <>
      <Button asChild variant="outline" size={size}>
        <Link href={helpHref}>{HELP_CENTER.viewHelpCta}</Link>
      </Button>
      <Button type="button" variant="ghost" size={size} onClick={openChat}>
        {HELP_CENTER.askSupportCta}
      </Button>
    </>
  )
}
