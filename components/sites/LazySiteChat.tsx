'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SITE_AGENT_COPY as C } from '@/lib/marketing/copy/site-agent'
import { useSupportContext } from '@/components/live-support/SupportProvider'
import type { SiteChatWidget } from './SiteChatWidget'
import styles from '@/components/live-support/ConversationWidget.module.css'

const Chat = dynamic(() => import('./SiteChatWidget').then(module => module.SiteChatWidget), { ssr: false, loading: () => <Button size="icon" variant="ink" loading className={styles.launcher} aria-label={C.openChat}><MessageCircle aria-hidden /></Button> })
export function LazySiteChat(props: Parameters<typeof SiteChatWidget>[0]) {
  const [opened, setOpened] = useState(false)
  const support = useSupportContext()
  if (opened || support.panelOpen) return <Chat {...props} initiallyOpen={opened} />
  return <Button size="icon" variant="ink" className={styles.launcher} aria-label={C.openChat}
    onClick={() => setOpened(true)}><MessageCircle className="!h-6 !w-6" aria-hidden /></Button>
}
