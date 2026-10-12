'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Info, MessageCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SupportChatPanel } from '@/components/live-support/SupportChatPanel'
import { useSupportContext } from '@/components/live-support/SupportProvider'
import { useSupportSession } from '@/components/live-support/useSupportPolling'
import { useSiteAgentConversation } from '@/hooks/useSiteAgentConversation'
import { SiteAgent } from './SiteAgent'
import { SITE_AGENT_COPY as C } from '@/lib/marketing/copy/site-agent'
import { SUPPORT_CHAT } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'
import styles from './SiteChatWidget.module.css'

const supportDraftKey = 'fixflags:support:draft'

export function SiteChatWidget({ siteId, host, ownsSite, flagId, flagTitle }: {
  siteId: string; host: string; ownsSite: boolean; flagId?: string; flagTitle?: string
}) {
  const support = useSupportContext()
  const [questionsOpen, setQuestionsOpen] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [viewport, setViewport] = useState<CSSProperties>({})
  const [supportDraft, setSupportDraft] = useState('')
  const [supportSending, setSupportSending] = useState(false)
  const [supportError, setSupportError] = useState<string | null>(null)
  const supportPending = useRef(false)
  const launcher = useRef<HTMLButtonElement>(null)
  const open = questionsOpen || support.panelOpen
  const showSupport = support.panelOpen || !ownsSite
  const conversation = useSiteAgentConversation(siteId, flagId, open && ownsSite && !showSupport)
  const { data, mutate } = useSupportSession(true, support.panelOpen)
  const onRead = useCallback(() => { void mutate() }, [mutate])
  const { sessionId, setSessionId } = support
  useEffect(() => {
    if (data?.session?.id && !sessionId) setSessionId(data.session.id)
  }, [data?.session?.id, sessionId, setSessionId])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 639px)')
    const resize = () => {
      setMobile(media.matches)
      const visual = window.visualViewport
      setViewport(visual ? {
        '--chat-viewport-height': `${visual.height}px`, '--chat-viewport-top': `${visual.offsetTop}px`,
      } as CSSProperties : {})
    }
    resize()
    media.addEventListener('change', resize)
    window.visualViewport?.addEventListener('resize', resize)
    window.visualViewport?.addEventListener('scroll', resize)
    return () => {
      media.removeEventListener('change', resize)
      window.visualViewport?.removeEventListener('resize', resize)
      window.visualViewport?.removeEventListener('scroll', resize)
    }
  }, [])

  useEffect(() => {
    try { setSupportDraft(sessionStorage.getItem(supportDraftKey) ?? '') } catch { /* Draft stays in memory. */ }
  }, [])
  const changeSupportDraft = useCallback((value: string) => {
    setSupportDraft(value)
    try { sessionStorage.setItem(supportDraftKey, value) } catch { /* Draft stays in memory. */ }
  }, [])
  const beginSupportSend = useCallback(() => {
    if (supportPending.current) return false
    supportPending.current = true
    setSupportSending(true)
    return true
  }, [])
  const endSupportSend = useCallback(() => { supportPending.current = false; setSupportSending(false) }, [])

  function close() { setQuestionsOpen(false); support.setPanelOpen(false) }
  function selectSupport() { setQuestionsOpen(false); support.openSupportChat() }
  function selectQuestions() { support.setPanelOpen(false); setQuestionsOpen(true) }
  const unread = data?.session?.unreadByVisitor ?? 0

  return <>
    <Button ref={launcher} size="icon" variant="ink" className={cn(styles.launcher, open && 'hidden')}
      aria-label={C.openChat} aria-expanded={open} aria-controls="site-chat-window"
      onClick={() => ownsSite ? selectQuestions() : selectSupport()}>
      <MessageCircle className="!h-6 !w-6" aria-hidden />
      {unread > 0 ? <span aria-label={C.unread(unread)} className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-3xs font-bold text-destructive-foreground">{unread > 9 ? '9+' : unread}</span> : null}
    </Button>
    <Dialog.Root open={open} onOpenChange={value => { if (!value) close() }} modal={mobile}>
      <Dialog.Portal>
        <Dialog.Content id="site-chat-window" style={viewport} className={styles.panel} aria-modal={mobile || undefined}
          onInteractOutside={event => event.preventDefault()}
          onOpenAutoFocus={event => {
            event.preventDefault()
            document.querySelector<HTMLTextAreaElement>('#site-chat-window textarea')?.focus({ preventScroll: true })
          }}
          onCloseAutoFocus={event => { event.preventDefault(); launcher.current?.focus() }}>
          <header className="shrink-0 px-4 pt-3">
            <div className="flex items-center justify-between gap-2">
              <Dialog.Title className="text-base font-semibold">{C.chatTitle}</Dialog.Title>
              <Button variant="ghost" size="icon" aria-label={C.closeChat} onClick={close}><X aria-hidden /></Button>
            </div>
            <Dialog.Description className="sr-only">{showSupport ? SUPPORT_CHAT.subtitle : flagId ? C.flagDescription : C.description}</Dialog.Description>
            {ownsSite ? <div role="tablist" tabIndex={-1} aria-label={C.chatTitle} className="mt-1 flex gap-1 rounded-control bg-muted p-1"
              onKeyDown={event => {
                if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                  event.preventDefault()
                  const toSupport = event.key === 'End' || (!showSupport && event.key !== 'Home')
                  if (toSupport) selectSupport(); else selectQuestions()
                  document.getElementById(toSupport ? 'site-chat-support-tab' : 'site-chat-questions-tab')?.focus()
                }
              }}>
              <Button id="site-chat-questions-tab" role="tab" aria-selected={!showSupport} aria-controls="site-chat-questions" tabIndex={showSupport ? -1 : 0}
                variant="ghost" className={cn('flex-1', !showSupport && 'bg-background shadow-sm')} onClick={selectQuestions}>{C.siteQuestions}</Button>
              <Button id="site-chat-support-tab" role="tab" aria-label={C.support} aria-selected={showSupport} aria-controls="site-chat-support" tabIndex={showSupport ? 0 : -1}
                variant="ghost" className={cn('flex-1', showSupport && 'bg-background shadow-sm')} onClick={selectSupport}>{C.support}
                {unread > 0 ? <span className="h-2 w-2 rounded-full bg-destructive" aria-label={C.unread(unread)} /> : null}
              </Button>
            </div> : null}
            {!showSupport ? <div className="mt-2 flex items-start justify-between gap-2">
              <div className="min-w-0 py-2 text-xs text-muted-foreground"><p className="break-words">{host}</p>{flagTitle ? <p className="mt-1 line-clamp-2" title={flagTitle}>{flagTitle}</p> : null}</div>
              <details className="relative shrink-0">
                <summary aria-label={C.information} className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-control text-muted-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden"><Info size={16} aria-hidden /></summary>
                <p className="absolute right-0 z-10 w-64 rounded-control bg-muted p-3 text-xs leading-relaxed shadow-card">{C.boundary}</p>
              </details>
            </div> : <p className="py-3 text-xs text-muted-foreground">{SUPPORT_CHAT.subtitle}</p>}
          </header>
          <div id={showSupport ? 'site-chat-support' : 'site-chat-questions'} role={ownsSite ? 'tabpanel' : undefined}
            aria-labelledby={ownsSite ? showSupport ? 'site-chat-support-tab' : 'site-chat-questions-tab' : undefined}
            className="flex min-h-0 flex-1 flex-col">
            {showSupport ? <SupportChatPanel compact onRead={onRead} composer={{ draft: supportDraft, setDraft: changeSupportDraft,
              sending: supportSending, beginSend: beginSupportSend, endSend: endSupportSend,
              error: supportError, setError: setSupportError }} /> : <SiteAgent conversation={conversation} />}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </>
}
