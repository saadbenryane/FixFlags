'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Info, MessageCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SupportChatPanel } from '@/components/live-support/SupportChatPanel'
import { useSupportContext } from '@/components/live-support/SupportProvider'
import { useSupportSession } from '@/components/live-support/useSupportPolling'
import { useSiteAgentConversation } from '@/hooks/useSiteAgentConversation'
import { SiteAgent } from '@/components/sites/SiteAgent'
import { SITE_AGENT_COPY as C } from '@/lib/marketing/copy/site-agent'
import { SUPPORT_CHAT } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'
import { useFocusYield } from '@/components/system/useFocusYield'
import styles from './ConversationWidget.module.css'

const supportDraftKey = 'fixflags:support:draft'

type ConversationWidgetProps = {
  flagId?: string; flagTitle?: string; initiallyOpen?: boolean
} & ({ supportOnly: true; siteId?: never; host?: never; ownsSite?: never }
  | { supportOnly?: false; siteId: string; host: string; ownsSite: boolean })

/** One responsive conversation window for Site questions and public support. */
export function ConversationWidget(props: ConversationWidgetProps) {
  const { flagId, flagTitle, initiallyOpen = false } = props
  const siteId = props.supportOnly ? null : props.siteId
  const host = props.supportOnly ? null : props.host
  const ownsSite = props.supportOnly ? false : props.ownsSite
  const title = props.supportOnly ? SUPPORT_CHAT.title : C.chatTitle
  const openLabel = props.supportOnly ? SUPPORT_CHAT.ariaOpen : C.openChat
  const closeLabel = props.supportOnly ? SUPPORT_CHAT.ariaClose : C.closeChat
  const support = useSupportContext()
  const { openSupportChat, setPanelOpen } = support
  useEffect(() => { if (initiallyOpen && !ownsSite) openSupportChat() }, [initiallyOpen, ownsSite, openSupportChat])
  const [questionsOpen, setQuestionsOpen] = useState(initiallyOpen && ownsSite)
  const [mobile, setMobile] = useState(false)
  const [viewport, setViewport] = useState<CSSProperties>({})
  const [supportDraft, setSupportDraft] = useState('')
  const [supportSending, setSupportSending] = useState(false)
  const [supportError, setSupportError] = useState<string | null>(null)
  const supportPending = useRef(false)
  const launcher = useRef<HTMLButtonElement>(null)
  useFocusYield(launcher)
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

  const uncoveredFocus = useRef<HTMLElement | null>(null)
  function close() { uncoveredFocus.current = null; setQuestionsOpen(false); support.setPanelOpen(false) }
  function selectSupport() { setQuestionsOpen(false); support.openSupportChat() }
  function selectQuestions() { support.setPanelOpen(false); setQuestionsOpen(true) }
  useEffect(() => {
    if (!open || mobile) return
    const revealFocus = (event: FocusEvent) => {
      const target = event.target
      const panel = document.getElementById('site-chat-window')
      if (!(target instanceof HTMLElement) || !panel || panel.contains(target)) return
      const focused = target.getBoundingClientRect(), windowRect = panel.getBoundingClientRect()
      if (focused.right > windowRect.left && focused.left < windowRect.right &&
        focused.bottom > windowRect.top && focused.top < windowRect.bottom) {
        uncoveredFocus.current = target
        setQuestionsOpen(false)
        setPanelOpen(false)
      }
    }
    document.addEventListener('focusin', revealFocus)
    return () => document.removeEventListener('focusin', revealFocus)
  }, [open, mobile, setPanelOpen])
  const unread = data?.session?.unreadByVisitor ?? 0

  return <>
    <Button ref={launcher} size="icon" variant="ink" className={cn(styles.launcher, props.supportOnly && styles.publicLauncher, open && 'hidden')}
      aria-label={openLabel} aria-expanded={open} aria-controls="site-chat-window"
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
          onCloseAutoFocus={event => {
            event.preventDefault()
            const target = uncoveredFocus.current
            uncoveredFocus.current = null
            if (target?.isConnected) target.focus({ preventScroll: true })
            else launcher.current?.focus()
          }}>
          <div className="shrink-0 px-4 pt-3">
            <div className="flex items-center justify-between gap-2">
              <Dialog.Title className="text-base font-semibold">{title}</Dialog.Title>
              <Button variant="ghost" size="icon" aria-label={closeLabel} onClick={close}><X aria-hidden /></Button>
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
            </div> : null}
          </div>
          <div id={showSupport ? 'site-chat-support' : 'site-chat-questions'} role={ownsSite ? 'tabpanel' : undefined}
            aria-labelledby={ownsSite ? showSupport ? 'site-chat-support-tab' : 'site-chat-questions-tab' : undefined}
            className="flex min-h-0 flex-1 flex-col">
            {showSupport ? <SupportChatPanel compact onRead={onRead} composer={{ draft: supportDraft, setDraft: changeSupportDraft,
              sending: supportSending, beginSend: beginSupportSend, endSend: endSupportSend,
              error: supportError, setError: setSupportError }} /> : siteId ? <SiteAgent conversation={{ ...conversation, siteId }} /> : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </>
}
