'use client'

import { ConversationWidget } from '@/components/live-support/ConversationWidget'

type SiteChatWidgetProps = Extract<Parameters<typeof ConversationWidget>[0], { siteId: string }>

/** Preserve the Site-specific entry point around the shared conversation window. */
export function SiteChatWidget(props: SiteChatWidgetProps) {
  return <ConversationWidget {...props} />
}
