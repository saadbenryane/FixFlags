'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { TextLink } from '@/components/ui/text-link'
import { cn } from '@/lib/utils'
import { MessageBubble } from '@/components/support/MessageBubble'
import {
  useAdminSupportMessages,
  useAdminSupportSessions,
} from '@/components/live-support/useSupportPolling'
import type { SupportMessageDto, SupportSessionListItem } from '@/lib/live-support/types'

function SessionRow({
  session,
  selected,
  onSelect,
}: {
  session: SupportSessionListItem
  selected: boolean
  onSelect: () => void
}) {
  const label =
    session.visitorEmail ?? session.user?.email ?? session.visitorName ?? 'Anonymous'
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full text-left px-4 py-3 border-b border-border transition-colors',
        selected ? 'bg-muted/60' : 'hover:bg-muted/30'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium truncate">{label}</span>
        {session.unreadByAgent > 0 && (
          <Badge variant="destructive" className="text-[10px] shrink-0">
            {session.unreadByAgent}
          </Badge>
        )}
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="text-[10px]">
          {session.status}
        </Badge>
        {session.lead?.normalizedDomain && (
          <span className="truncate">{session.lead.normalizedDomain}</span>
        )}
      </div>
    </button>
  )
}

function AdminMessage({ message }: { message: SupportMessageDto }) {
  const isAgent = message.role === 'AGENT'
  const isSystem = message.role === 'SYSTEM'
  if (isSystem) {
    return <p className="text-center text-xs text-muted-foreground">{message.body}</p>
  }
  return (
    <MessageBubble variant={isAgent ? 'agent' : 'visitor'}>
      {message.body}
    </MessageBubble>
  )
}

export function AdminInbox() {
  const searchParams = useSearchParams()
  const initialSession = searchParams.get('session')
  const [selectedId, setSelectedId] = useState<string | null>(initialSession)
  const [filter, setFilter] = useState<'open' | 'closed' | 'all'>(initialSession ? 'all' : 'open')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data: sessionsData, mutate: mutateSessions, isLoading: sessionsLoading } =
    useAdminSupportSessions(filter)
  const { data: messagesData, mutate: mutateMessages } = useAdminSupportMessages(selectedId)

  const sessions = (sessionsData?.sessions ?? []) as SupportSessionListItem[]
  const selected = sessions.find((s) => s.id === selectedId) ?? null
  const messages = messagesData?.messages ?? []
  const messageCount = messages.length

  useEffect(() => {
    if (initialSession && !selectedId) setSelectedId(initialSession)
  }, [initialSession, selectedId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messageCount])

  useEffect(() => {
    if (!selectedId) return
    void fetch(`/api/admin/support/sessions/${selectedId}/messages`, { method: 'PATCH' })
  }, [selectedId, messageCount])

  const sendReply = useCallback(async () => {
    if (!selectedId || !draft.trim() || sending) return
    setSending(true)
    try {
      const res = await fetch(`/api/admin/support/sessions/${selectedId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: draft.trim() }),
      })
      if (!res.ok) {
        toast.error('Failed to send reply')
        return
      }
      setDraft('')
      await Promise.all([mutateMessages(), mutateSessions()])
    } finally {
      setSending(false)
    }
  }, [selectedId, draft, sending, mutateMessages, mutateSessions])

  async function closeSession() {
    if (!selectedId) return
    const res = await fetch(`/api/admin/support/sessions/${selectedId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED' }),
    })
    if (res.ok) {
      toast.success('Session closed')
      await mutateSessions()
    }
  }

  return (
    <div className="grid min-h-[32rem] grid-cols-1 overflow-hidden rounded-card glass-surface-strong shadow-card lg:grid-cols-[280px_1fr_240px]">
      <div className="border-b border-border lg:border-b-0 lg:border-r">
        <div className="flex gap-1 border-b border-border p-2">
          {(['open', 'closed', 'all'] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'default' : 'ghost'}
              onClick={() => setFilter(f)}
              className="capitalize text-xs"
            >
              {f}
            </Button>
          ))}
        </div>
        <div className="max-h-[28rem] overflow-y-auto lg:max-h-none lg:h-full">
          {sessionsLoading && (
            <p className="p-4 text-sm text-muted-foreground">Loading sessions…</p>
          )}
          {!sessionsLoading && sessions.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No sessions yet.</p>
          )}
          {!sessionsLoading &&
            sessions.map((s) => (
            <SessionRow
              key={s.id}
              session={s}
              selected={s.id === selectedId}
              onSelect={() => setSelectedId(s.id)}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col min-h-[20rem]">
        {selected ? (
          <>
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="text-sm font-semibold">
                  {selected.visitorEmail ?? selected.user?.email ?? 'Anonymous visitor'}
                </p>
                <p className="text-xs text-muted-foreground">{selected.status}</p>
              </div>
              {selected.status !== 'CLOSED' && (
                <Button variant="outline" size="sm" onClick={() => void closeSession()}>
                  Close
                </Button>
              )}
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map((m) => (
                <AdminMessage key={m.id} message={m} />
              ))}
              <div ref={bottomRef} />
            </div>
            {selected.status !== 'CLOSED' && (
              <form
                className="flex gap-2 border-t border-border p-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  void sendReply()
                }}
              >
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={2}
                  placeholder="Reply as FixFlags team…"
                  className="flex-1 resize-none"
                />
                <Button type="submit" size="icon" disabled={sending || !draft.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            )}
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Select a conversation
          </div>
        )}
      </div>

      <div className="border-t border-border p-4 text-sm lg:border-t-0 lg:border-l space-y-3">
        <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Context</p>
        {selected ? (
          <>
            {selected.pageUrl && (
              <div>
                <p className="text-xs text-muted-foreground">Page</p>
                <p className="truncate text-xs">{selected.pageUrl}</p>
              </div>
            )}
            {selected.lead && (
              <div>
                <p className="text-xs text-muted-foreground">Lead</p>
                <TextLink href={`/admin/leads/${encodeURIComponent(selected.lead.normalizedDomain)}`}>
                  {selected.lead.normalizedDomain}
                </TextLink>
                {selected.lead.latestScore != null && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Score: {selected.lead.latestScore}
                  </p>
                )}
              </div>
            )}
            {selected.user && (
              <div>
                <p className="text-xs text-muted-foreground">Account</p>
                <p>{selected.user.email}</p>
                <Badge variant="outline" className="mt-1 text-[10px]">
                  {selected.user.plan}
                </Badge>
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Visitor context appears here.</p>
        )}
      </div>
    </div>
  )
}
