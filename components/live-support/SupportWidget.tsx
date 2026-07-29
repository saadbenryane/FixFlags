'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { MessageCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SUPPORT_CHAT } from '@/lib/marketing/copy'
import { extractAuditIdFromPath } from '@/lib/live-support/extract-audit-id'
import { useSupportContext } from '@/components/live-support/SupportProvider'
import { SupportChatPanel } from '@/components/live-support/SupportChatPanel'
import { useSupportSession } from '@/components/live-support/useSupportPolling'
import { toast } from 'sonner'

function SupportWidgetInner() {
  const pathname = usePathname()
  const pathAuditId = extractAuditIdFromPath(pathname)
  const { panelOpen, setPanelOpen, sessionId, setSessionId, auditId, openSupportChat } =
    useSupportContext()
  const resolvedAuditId = auditId ?? pathAuditId
  // One fetch when closed (unread badge); poll only while the panel is open.
  const { data } = useSupportSession(true, panelOpen)

  useEffect(() => {
    if (data?.session?.id && !sessionId) {
      setSessionId(data.session.id)
    }
  }, [data?.session?.id, sessionId, setSessionId])

  const unread = data?.session?.unreadByVisitor ?? 0

  async function ensureSession() {
    const res = await fetch('/api/support/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pageUrl: window.location.href,
        auditId: resolvedAuditId ?? undefined,
      }),
    })
    if (!res.ok) return null
    const json = (await res.json()) as { session: { id: string } }
    setSessionId(json.session.id)
    return json.session.id
  }

  async function openPanel() {
    openSupportChat({ auditId: resolvedAuditId })
    if (!sessionId) {
      const id = await ensureSession()
      if (!id) {
        toast.error(SUPPORT_CHAT.startError)
      }
    }
  }

  return (
    <>
      {panelOpen && (
        <div
          className="fixed bottom-[calc(var(--floating-action-offset)_+_env(safe-area-inset-bottom))] right-[calc(var(--floating-action-offset)_+_env(safe-area-inset-right))] z-fab flex h-[min(32rem,calc(100vh_-_var(--floating-action-offset)_-_var(--floating-action-offset)_-_env(safe-area-inset-bottom)))] w-[min(24rem,calc(100vw_-_var(--floating-action-offset)_-_var(--floating-action-offset)_-_env(safe-area-inset-right)))] flex-col overflow-hidden rounded-card glass-surface-elevated shadow-raised"
          role="dialog"
          aria-label={SUPPORT_CHAT.ariaDialog}
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold">{SUPPORT_CHAT.title}</p>
              <p className="text-xs text-muted-foreground">{SUPPORT_CHAT.subtitle}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPanelOpen(false)}
              aria-label={SUPPORT_CHAT.ariaClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <SupportChatPanel auditId={resolvedAuditId} />
        </div>
      )}

      {!panelOpen && (
        <Button
          onClick={() => void openPanel()}
          variant="ink"
          size="icon"
          className="fixed bottom-[calc(var(--floating-action-offset)_+_env(safe-area-inset-bottom))] right-[calc(var(--floating-action-offset)_+_env(safe-area-inset-right))] z-fab h-14 w-14 rounded-full shadow-card"
          aria-label={SUPPORT_CHAT.ariaOpen}
        >
          <MessageCircle className="h-6 w-6" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-3xs font-bold text-destructive-foreground">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      )}
    </>
  )
}

export function SupportWidget({ auditId }: { auditId?: string | null }) {
  // Provider lives in SiteShell so Help pages can call openSupportChat.
  // When auditId prop is passed, sync override via inner effect-free pass-through:
  // SupportWidgetLazy may still receive auditId; SiteShell mounts without one.
  void auditId
  return <SupportWidgetInner />
}
