'use client'

import { useEffect } from 'react'
import { MessageCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { BRAND } from '@/lib/marketing/copy'
import { SupportProvider, useSupportContext } from '@/components/live-support/SupportProvider'
import { SupportChatPanel } from '@/components/live-support/SupportChatPanel'
import { useSupportSession } from '@/components/live-support/useSupportPolling'

function SupportWidgetInner() {
  const { panelOpen, setPanelOpen, sessionId, setSessionId } = useSupportContext()
  const { data } = useSupportSession(true)

  useEffect(() => {
    if (data?.session?.id && !sessionId) {
      setSessionId(data.session.id)
    }
  }, [data?.session?.id, sessionId, setSessionId])

  const unread = data?.session?.unreadByVisitor ?? 0

  async function openPanel() {
    setPanelOpen(true)
    if (!sessionId) {
      try {
        const res = await fetch('/api/support/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageUrl: window.location.href }),
        })
        if (res.ok) {
          const json = (await res.json()) as { session: { id: string } }
          setSessionId(json.session.id)
        }
      } catch {
        // Panel still opens; send will retry session creation
      }
    }
  }

  return (
    <>
      {panelOpen && (
        <div
          className="fixed bottom-20 right-4 z-[60] flex h-[min(32rem,calc(100vh-6rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
          role="dialog"
          aria-label="Live chat with FixFlags"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Chat with {BRAND.name}</p>
              <p className="text-xs text-muted-foreground">We reply live during business hours</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPanelOpen(false)}
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <SupportChatPanel />
        </div>
      )}

      {!panelOpen && (
        <Button
          onClick={() => void openPanel()}
          size="icon"
          className={cn(
            'fixed bottom-20 right-4 z-[60] h-14 w-14 rounded-full shadow-lg',
            'bg-brand text-brand-foreground hover:bg-brand/90'
          )}
          aria-label="Open live chat"
        >
          <MessageCircle className="h-6 w-6" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      )}
    </>
  )
}

export function SupportWidget() {
  return (
    <SupportProvider>
      <SupportWidgetInner />
    </SupportProvider>
  )
}
