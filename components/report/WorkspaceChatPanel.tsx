'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { History, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { AgentMessage } from '@/lib/audit/agent-message'
import { startScanWithHandoff } from '@/lib/audit/start-scan-handoff'
import { REPORT_COPY } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

interface WorkspaceChatPanelProps {
  auditId: string
  /** Interactive model conversation requires the signed-in report owner. */
  canChat?: boolean
  className?: string
  observationAuditId?: string | null
  /** Deterministic scan messages share this transcript and consume no model usage. */
  agentMessages?: AgentMessage[]
  reportUrl?: string
}

interface ChatMeta {
  available: boolean
  exhausted: boolean
  limit: number | null
  used: number
  remaining: number | null
  resetAt: string | null
}

interface HistoryItem {
  id: string
  url: string
  status: string
  score?: number | null
  unresolvedFlagCount?: number | null
  createdAt?: string | null
  parentId?: string | null
  reviewKind?: 'product_review' | 'update_review'
}

const chatCopy = REPORT_COPY.workspace.chat

function conversationMessage(
  auditId: string,
  message: { id?: string; role: 'user' | 'assistant' | 'agent'; content: string },
  index: number,
): AgentMessage {
  const isUser = message.role === 'user'
  return {
    id: message.id ?? `history:${auditId}:${index}`,
    sessionId: auditId,
    auditId,
    role: isUser ? 'user' : 'agent',
    source: isUser ? 'user' : 'model',
    kind: 'conversation',
    content: message.content,
  }
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function usageLabel(meta: ChatMeta): string | null {
  if (meta.limit == null || meta.remaining == null) return null
  const percent = meta.limit > 0 ? Math.max(0, Math.round((meta.remaining / meta.limit) * 100)) : 0
  return `${percent}% left`
}

export function WorkspaceChatPanel({
  auditId,
  canChat = true,
  className,
  observationAuditId,
  agentMessages = [],
  reportUrl = '',
}: WorkspaceChatPanelProps) {
  const [conversation, setConversation] = useState<AgentMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(!canChat)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [meta, setMeta] = useState<ChatMeta>({
    available: true,
    exhausted: false,
    limit: null,
    used: 0,
    remaining: null,
    resetAt: null,
  })
  const [newScan, setNewScan] = useState(false)
  const [scanUrl, setScanUrl] = useState('')
  const [scanError, setScanError] = useState<string | null>(null)
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([])
  const [historyCursor, setHistoryCursor] = useState<string | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyListError, setHistoryListError] = useState<string | null>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const scanInputRef = useRef<HTMLInputElement>(null)

  const signInHref = { pathname: '/sign-in', query: { next: `/report/${auditId}` } }

  async function loadConversation() {
    if (!canChat) return
    setHistoryError(null)
    setHistoryLoaded(false)
    const observationQuery =
      observationAuditId && observationAuditId !== auditId
        ? `?observationAuditId=${encodeURIComponent(observationAuditId)}`
        : ''
    try {
      const response = await fetch(`/api/reports/${auditId}/chat${observationQuery}`)
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : chatCopy.unavailable)
      const rawMessages = Array.isArray(data?.agentMessages) ? data.agentMessages : data?.messages
      const messages = Array.isArray(rawMessages)
        ? rawMessages
            .filter((item: unknown): item is { id?: string; role: 'user' | 'assistant' | 'agent'; content: string } =>
              Boolean(item && typeof item === 'object' && 'role' in item && 'content' in item),
            )
            .map((message: { id?: string; role: 'user' | 'assistant' | 'agent'; content: string }, index: number) =>
              conversationMessage(auditId, message, index),
            )
        : []
      setConversation(messages)
      const usage = data?.usage ?? data?.allowance ?? {}
      const limit = typeof usage.limit === 'number' ? usage.limit : null
      const used = typeof usage.used === 'number' ? usage.used : 0
      const remaining = typeof usage.remaining === 'number'
        ? usage.remaining
        : limit == null ? null : Math.max(0, limit - used)
      setMeta({
        available: data?.available !== false,
        exhausted: data?.exhausted === true || (remaining != null && remaining <= 0),
        limit,
        used,
        remaining,
        resetAt: typeof usage.resetAt === 'string' ? usage.resetAt : null,
      })
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : chatCopy.unavailable)
    } finally {
      setHistoryLoaded(true)
    }
  }

  useEffect(() => {
    void loadConversation()
    // The callback deliberately reloads when the selected observation changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditId, observationAuditId, canChat])

  const messages = useMemo(() => {
    const combined = [...agentMessages, ...conversation]
    const seen = new Set<string>()
    return combined.filter((message) => {
      if (seen.has(message.id)) return false
      seen.add(message.id)
      return true
    })
  }, [agentMessages, conversation])

  useEffect(() => {
    const node = transcriptRef.current
    if (!node) return
    const nearBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 96
    if (nearBottom) {
      if (typeof node.scrollTo === 'function') {
        node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' })
      } else {
        node.scrollTop = node.scrollHeight
      }
    }
  }, [messages.length])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading || meta.exhausted) return
    const localUser: AgentMessage = {
      id: `local:${auditId}:${Date.now()}:user`,
      sessionId: auditId,
      auditId,
      role: 'user',
      source: 'user',
      kind: 'conversation',
      content: trimmed,
    }
    setConversation((current) => [...current, localUser])
    setInput('')
    setLoading(true)
    try {
      const response = await fetch(`/api/reports/${auditId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          observationAuditId:
            observationAuditId && observationAuditId !== auditId
              ? observationAuditId
              : undefined,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (response.status === 429 && data?.code === 'CHAT_ALLOWANCE_EXHAUSTED') {
        setMeta((current) => ({ ...current, exhausted: true, remaining: 0 }))
        return
      }
      if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : chatCopy.unavailable)
      const reply = data?.agentMessage?.content ?? data?.reply
      if (typeof reply !== 'string' || !reply.trim()) throw new Error(chatCopy.replyFallback)
      const modelMessage: AgentMessage = data?.agentMessage && typeof data.agentMessage.id === 'string'
        ? data.agentMessage
        : {
            id: `local:${auditId}:${Date.now()}:agent`,
            sessionId: auditId,
            auditId,
            role: 'agent',
            source: 'model',
            kind: 'conversation',
            content: reply,
          }
      setConversation((current) => [...current, modelMessage])
      const usage = data?.usage ?? data?.allowance
      if (usage && typeof usage === 'object') {
        setMeta((current) => ({
          ...current,
          limit: typeof usage.limit === 'number' ? usage.limit : current.limit,
          used: typeof usage.used === 'number' ? usage.used : current.used,
          remaining: typeof usage.remaining === 'number' ? usage.remaining : current.remaining,
          resetAt: typeof usage.resetAt === 'string' ? usage.resetAt : current.resetAt,
          exhausted: usage.exhausted === true || usage.remaining === 0,
        }))
      }
    } catch (error) {
      setConversation((current) => [
        ...current,
        {
          id: `local:${auditId}:${Date.now()}:warning`,
          sessionId: auditId,
          auditId,
          role: 'agent',
          source: 'model',
          kind: 'warning',
          state: 'warning',
          content: error instanceof Error ? error.message : chatCopy.unavailable,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  async function startScan() {
    const url = scanUrl.trim()
    if (!url || loading) return
    setLoading(true)
    setScanError(null)
    const result = await startScanWithHandoff({
      url,
      body: { url, source: 'report' },
      errorFallback: chatCopy.startError,
    })
    if (!result.ok) {
      setScanError(result.message)
      setLoading(false)
    }
  }

  async function loadHistory(cursor?: string) {
    if (!canChat) return
    if (historyLoading) return
    setHistoryLoading(true)
    setHistoryListError(null)
    try {
      const response = await fetch(cursor ? `/api/reports/history?cursor=${encodeURIComponent(cursor)}` : '/api/reports/history')
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : chatCopy.historyError)
      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data?.reports) ? data.reports : []
      setHistoryItems((current) => cursor ? [...current, ...items] : items)
      setHistoryCursor(typeof data?.nextCursor === 'string' ? data.nextCursor : null)
    } catch (error) {
      setHistoryListError(error instanceof Error ? error.message : chatCopy.historyError)
    } finally {
      setHistoryLoading(false)
    }
  }

  const remainingLabel = usageLabel(meta)

  return (
    <TooltipProvider>
      <section
        className={cn(
          'flex min-h-[420px] max-h-[min(72dvh,760px)] flex-col overflow-hidden rounded-card bg-card/70 shadow-card glass-surface',
          className,
        )}
        aria-label="Agent"
      >
        <div className="flex min-h-14 items-center justify-end gap-1 border-b border-border/40 px-2">
          <Sheet onOpenChange={(open) => { if (open) void loadHistory() }}>
            <Tooltip>
              <TooltipTrigger asChild>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={chatCopy.historyLabel}>
                    <History className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </SheetTrigger>
              </TooltipTrigger>
              <TooltipContent>{chatCopy.historyTooltip}</TooltipContent>
            </Tooltip>
            <SheetContent side="left" className="w-full sm:max-w-md">
              <SheetHeader>
                <SheetTitle>{chatCopy.historyLabel}</SheetTitle>
                <SheetDescription>{chatCopy.historyDescription}</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-2 overflow-y-auto">
                {!canChat ? (
                  <div className="space-y-4 rounded-card bg-muted/35 p-4">
                    <Link href={`/report/${auditId}`} className="block min-h-11 rounded-[var(--radius-control)] bg-background px-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">
                      <span className="block text-sm font-medium text-foreground">{reportUrl ? hostname(reportUrl) : chatCopy.currentScan}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{chatCopy.currentSession}</span>
                    </Link>
                    <p className="text-sm text-muted-foreground">{chatCopy.saveHistory}</p>
                    <Button asChild className="w-full"><Link href={signInHref}>{chatCopy.signIn}</Link></Button>
                  </div>
                ) : historyListError ? (
                  <div className="space-y-3">
                    <p role="alert" className="text-sm text-destructive">{historyListError}</p>
                    <Button variant="outline" onClick={() => void loadHistory()}>{chatCopy.retry}</Button>
                  </div>
                ) : historyItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{chatCopy.historyEmpty}</p>
                ) : historyItems.map((item) => (
                  <Link
                    key={item.id}
                    href={`/report/${item.id}`}
                    className={cn(
                      'block min-h-11 rounded-[var(--radius-control)] px-3 py-3 transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                      item.id === auditId && 'bg-muted/45',
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-medium text-foreground">{hostname(item.url)}</span>
                      <span className="font-mono text-2xs text-muted-foreground">{item.score ?? item.status}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.reviewKind === 'update_review' || item.parentId ? chatCopy.updateReview : chatCopy.productReview}
                      {typeof item.unresolvedFlagCount === 'number' ? ` · ${item.unresolvedFlagCount} Flags` : ''}
                    </p>
                  </Link>
                ))}
                {canChat && historyCursor ? (
                  <Button
                    variant="outline"
                    className="min-h-11 w-full"
                    loading={historyLoading}
                    onClick={() => void loadHistory(historyCursor)}
                  >
                    {chatCopy.historyMore}
                  </Button>
                ) : null}
              </div>
            </SheetContent>
          </Sheet>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={chatCopy.newScan}
                onClick={() => {
                  setNewScan(true)
                  setScanError(null)
                  setTimeout(() => scanInputRef.current?.focus(), 0)
                }}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{chatCopy.newScan}</TooltipContent>
          </Tooltip>
        </div>

        <div
          ref={transcriptRef}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 text-sm"
          role="log"
          aria-label="Agent messages"
          aria-live="polite"
          aria-relevant="additions"
        >
          {newScan ? (
            <p className="max-w-[92%] whitespace-pre-line leading-relaxed text-muted-foreground">
              {chatCopy.newScanInstruction}
            </p>
          ) : null}
          {messages.map((message) => (
            <article
              key={message.id}
              className={cn(
                'max-w-[92%] whitespace-pre-line leading-relaxed',
                message.role === 'user'
                  ? 'ml-auto rounded-[var(--radius-control)] bg-muted/55 px-3 py-2 text-foreground'
                  : message.kind === 'failure'
                    ? 'text-destructive'
                    : 'text-muted-foreground',
              )}
              data-source={message.source}
            >
              {message.content}
              {message.flagId ? (
                <Link
                  href={`?flag=${encodeURIComponent(message.flagId)}#report-flags`}
                  className="mt-2 block min-h-11 py-2 text-sm font-medium text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  {chatCopy.viewFlag}
                </Link>
              ) : null}
            </article>
          ))}
          {!newScan && messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {historyLoaded ? chatCopy.preparing : chatCopy.loadingConversation}
            </p>
          ) : null}
        </div>

        {newScan ? (
          <form
            className="space-y-2 border-t border-border/40 p-3"
            onSubmit={(event) => { event.preventDefault(); void startScan() }}
          >
            <div className="flex gap-2">
              <Input
                ref={scanInputRef}
                value={scanUrl}
                onChange={(event) => setScanUrl(event.target.value)}
                placeholder={chatCopy.startPlaceholder}
                aria-label={chatCopy.startLabel}
                disabled={loading}
              />
              <Button type="submit" loading={loading} disabled={!scanUrl.trim()}>{chatCopy.startAction}</Button>
            </div>
            {scanError ? <p role="alert" className="text-xs text-destructive">{scanError}</p> : null}
            <button type="button" className="min-h-11 text-xs text-muted-foreground hover:text-foreground" onClick={() => setNewScan(false)}>
              {chatCopy.returnToReport}
            </button>
          </form>
        ) : !canChat ? (
          <div className="space-y-3 border-t border-border/40 bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">{chatCopy.authBody}</p>
            <Button asChild className="w-full"><Link href={signInHref}>{chatCopy.notSignedIn}</Link></Button>
          </div>
        ) : historyError ? (
          <div className="space-y-3 border-t border-border/40 p-3">
            <p role="alert" className="text-xs text-destructive">{historyError}</p>
            <Button variant="outline" className="w-full" onClick={() => void loadConversation()}>{chatCopy.retry}</Button>
          </div>
        ) : meta.exhausted ? (
          <div className="space-y-3 border-t border-border/40 p-3">
            <p className="text-xs text-muted-foreground">{chatCopy.allowanceBody}</p>
            <Button asChild className="w-full"><Link href="/pricing">{chatCopy.allowanceAction}</Link></Button>
          </div>
        ) : (
          <form
            className="space-y-2 border-t border-border/40 p-2"
            onSubmit={(event) => { event.preventDefault(); void send(input) }}
          >
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={chatCopy.placeholder}
                disabled={loading || !meta.available}
                className="text-sm"
              />
              <Button type="submit" size="sm" loading={loading} disabled={!input.trim() || !meta.available}>
                {chatCopy.send}
              </Button>
            </div>
            {remainingLabel ? <p className="px-1 text-right font-mono text-2xs text-muted-foreground">{remainingLabel}</p> : null}
          </form>
        )}
      </section>
    </TooltipProvider>
  )
}
