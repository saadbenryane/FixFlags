'use client'

import { HELP_CENTER, SUPPORT_CHAT, BRAND } from '@/lib/marketing/copy'
import { Button } from '@/components/ui/button'
import { useOptionalSupportContext } from '@/components/live-support/SupportProvider'

export function HelpChatEscalate({
  articleTitle,
  className,
}: {
  articleTitle?: string
  className?: string
}) {
  const support = useOptionalSupportContext()

  function handleOpenChat() {
    const prefill = articleTitle
      ? `${SUPPORT_CHAT.prefillPrefix} ${articleTitle}`
      : undefined
    if (support) {
      support.openSupportChat({
        pageUrl: typeof window !== 'undefined' ? window.location.href : undefined,
        prefill,
      })
      return
    }
    // Fallback if provider missing: scroll to FAB by focusing nothing; user can click FAB.
  }

  return (
    <div className={className}>
      <p className="text-sm font-medium text-foreground">{HELP_CENTER.stillStuck}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={handleOpenChat}>
          {HELP_CENTER.openChatCta}
        </Button>
        <Button asChild variant="outline" size="sm">
          <a href={`mailto:${BRAND.supportEmail}?subject=FixFlags%20help`}>
            {HELP_CENTER.emailCta}
          </a>
        </Button>
      </div>
    </div>
  )
}
