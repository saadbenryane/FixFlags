'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { ArrowUp, Flag, History, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScanWorkingMark } from '@/components/report/ScanWorkingStatus'
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
import { WorkspaceTranscript } from '@/components/report/WorkspaceTranscript'
import {
  WORKSPACE_AGENT_HEADER_CLASS,
  WORKSPACE_TRANSCRIPT_CLASS,
} from '@/components/report/workspace-geometry'
import type { AgentMessage } from '@/lib/audit/agent-message'
import { startScanWithHandoff } from '@/lib/audit/start-scan-handoff'
import { REPORT_COPY } from '@/lib/marketing/copy'
import { displaySiteAddress } from '@/lib/utils/url-helpers'
import { cn } from '@/lib/utils'
import type { ReportWorkspaceCapabilities } from '@/lib/report/workspace-model'
import { ReportClaimDialog } from '@/components/auth/ReportClaimDialog'
import { useReportAuthGate } from '@/components/auth/ReportAuthGate'

export type WorkspaceChatGateReason = 'sign-in' | 'owner'

interface WorkspaceChatPanelProps {
  /** Absent on curated marketing samples, which have no live report route. */
  auditId?: string
  /** Canonical workspace access decision. Chat never re-derives ownership. */
  capabilities: ReportWorkspaceCapabilities
  /** Explains a locked composer without pretending sign-in grants ownership. */
  gateReason: WorkspaceChatGateReason
  /** Copy for the sign-in dialog. Defaults to save-report for teaser owners. */
  claimReason?: 'save-report' | 'create-account'
  /** After signup, send the visitor here when this panel has no report id. */
  claimNextPath?: string
  className?: string
  observationAuditId?: string | null
  /** Deterministic scan messages share this transcript and consume no model usage. */
  agentMessages?: AgentMessage[]
  reportUrl?: string
  /** Persisted Product name when available; hostname remains the honest fallback. */
  productName?: string | null
  /** While true, the Agent header Flag mark animates as the working signal. */
  scanning?: boolean
  /** Curated homepage playback uses the same panel without live account tools. */
  showToolbarActions?: boolean
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

function usageLabel(meta: ChatMeta): string | null {
  if (meta.limit == null || meta.remaining == null) return null
  const percent = meta.limit > 0 ? Math.max(0, Math.round((meta.remaining / meta.limit) * 100)) : 0
  return `${percent}% left`
}

export function WorkspaceChatPanel({
  auditId,
  capabilities,
  gateReason,
  claimReason: defaultClaimReason = 'save-report',
  claimNextPath: claimNextPathProp,
  className,
  observationAuditId,
  agentMessages = [],
  reportUrl = '',
  productName = null,
  scanning = false,
  showToolbarActions = true,
}: WorkspaceChatPanelProps) {
  const router = useRouter()
  // A curated sample has no report route, so chat, history, and flag deep
  // links stay off while the transcript still shows the deterministic run.
  const canChat = capabilities.canChat && Boolean(auditId)
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
  const [claimOpen, setClaimOpen] = useState(false)
  const [claimReason, setClaimReason] = useState<'save-report' | 'scan-limit' | 'create-account'>(
    defaultClaimReason
  )
  const [claimNextOverride, setClaimNextOverride] = useState<string | undefined>()
  const authGate = useReportAuthGate()
  const transcriptRef = useRef<HTMLDivElement>(null)
  const scanInputRef = useRef<HTMLInputElement>(null)

  const claimNextPath =
    claimNextOverride ??
    (auditId ? `/report/${auditId}` : claimNextPathProp)

  function openSaveReportClaim() {
    if (authGate) {
      authGate.open({ reason: defaultClaimReason, nextPath: claimNextPath, auditId })
      return
    }
    setClaimReason(defaultClaimReason)
    setClaimNextOverride(undefined)
    setClaimOpen(true)
  }

  async function loadConversation() {
    const reportId = auditId
    if (!canChat || !reportId) return
    setHistoryError(null)
    setHistoryLoaded(false)
    const observationQuery =
      observationAuditId && observationAuditId !== reportId
        ? `?observationAuditId=${encodeURIComponent(observationAuditId)}`
        : ''
    try {
      const response = await fetch(`/api/reports/${reportId}/chat${observationQuery}`)
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : chatCopy.unavailable)
      const rawMessages = Array.isArray(data?.agentMessages) ? data.agentMessages : data?.messages
      const messages = Array.isArray(rawMessages)
        ? rawMessages
            .filter((item: unknown): item is { id?: string; role: 'user' | 'assistant' | 'agent'; content: string } =>
              Boolean(item && typeof item === 'object' && 'role' in item && 'content' in item),
            )
            .map((message: { id?: string; role: 'user' | 'assistant' | 'agent'; content: string }, index: number) =>
              conversationMessage(reportId, message, index),
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

  function gateToSignIn() {
    openSaveReportClaim()
  }

  async function send(text: string) {
    const trimmed = text.trim()
    if (loading) return
    // Anonymous owners may claim the report. Other viewers stay read-only
    // because signing in cannot grant ownership of somebody else's Review.
    if (!canChat) {
      if (gateReason === 'sign-in') gateToSignIn()
      return
    }
    if (!trimmed) return
    const reportId = auditId
    if (!reportId || meta.exhausted) return
    const localUser: AgentMessage = {
      id: `local:${reportId}:${Date.now()}:user`,
      sessionId: reportId,
      auditId: reportId,
      role: 'user',
      source: 'user',
      kind: 'conversation',
      content: trimmed,
    }
    setConversation((current) => [...current, localUser])
    setInput('')
    setLoading(true)
    try {
      const response = await fetch(`/api/reports/${reportId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          observationAuditId:
            observationAuditId && observationAuditId !== reportId
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
            id: `local:${reportId}:${Date.now()}:agent`,
            sessionId: reportId,
            auditId: reportId,
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
          id: `local:${reportId}:${Date.now()}:warning`,
          sessionId: reportId,
          auditId: reportId,
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
      replace: (href) => router.replace(href as Route),
    })
    if (!result.ok) {
      if (result.code === 'AUTH_REQUIRED') {
        if (authGate) {
          authGate.open({
            reason: 'scan-limit',
            nextPath: `/dashboard?url=${encodeURIComponent(url)}`,
            auditId,
          })
        } else {
          setClaimReason('scan-limit')
          setClaimNextOverride(`/dashboard?url=${encodeURIComponent(url)}`)
          setClaimOpen(true)
        }
      } else {
        setScanError(result.message)
      }
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
  const reportHost = reportUrl ? displaySiteAddress(reportUrl) : ''
  const displayProductName = productName?.trim() || reportHost || chatCopy.currentScan

  return (
    <TooltipProvider>
      <section
        className={cn(
          'flex h-full min-h-0 flex-col overflow-hidden border-r border-border/50 bg-background',
          className,
        )}
        aria-label="Agent"
      >
        <div className={WORKSPACE_AGENT_HEADER_CLASS}>
          {scanning ? (
            <ScanWorkingMark className="h-9 w-9" />
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 ring-1 ring-brand/20">
              <Flag className="h-4 w-4 text-brand" aria-hidden />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {displayProductName}
            </p>
            <p className="mt-0.5 truncate text-2xs text-muted-foreground">
              {productName && reportHost && productName.trim() !== reportHost
                ? reportHost
                : 'FixFlags product review'}
            </p>
          </div>
          {showToolbarActions ? (
            <>
              {gateReason === 'sign-in' ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={chatCopy.historyLabel}
                      onClick={() => openSaveReportClaim()}
                    >
                      <History className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{chatCopy.historyTooltip}</TooltipContent>
                </Tooltip>
              ) : (
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
                    {auditId ? (
                      <Link href={`/report/${auditId}`} className="block min-h-11 rounded-[var(--radius-control)] bg-background px-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">
                        <span className="block text-sm font-medium text-foreground">{reportUrl ? displaySiteAddress(reportUrl) : chatCopy.currentScan}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">{chatCopy.currentSession}</span>
                      </Link>
                    ) : null}
                    <p className="text-sm text-muted-foreground">
                      {chatCopy.notOwner}
                    </p>
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
                      <span className="truncate text-sm font-medium text-foreground">{displaySiteAddress(item.url)}</span>
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
              )}

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
            </>
          ) : null}
        </div>

        <div
          ref={transcriptRef}
          className={WORKSPACE_TRANSCRIPT_CLASS}
          role="tabpanel"
          tabIndex={0}
          aria-label="Agent messages"
          aria-live="polite"
          aria-relevant="additions"
        >
          {newScan ? (
            <p className="max-w-[92%] whitespace-pre-line leading-relaxed text-muted-foreground">
              {chatCopy.newScanInstruction}
            </p>
          ) : null}
          <WorkspaceTranscript messages={messages} linkFlags={Boolean(auditId)} />
          {!newScan && messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {historyLoaded || !canChat ? chatCopy.preparing : chatCopy.loadingConversation}
            </p>
          ) : null}
        </div>

        {newScan ? (
          <form
            className="space-y-2 border-t border-border/40 p-3"
            onSubmit={(event) => { event.preventDefault(); void startScan() }}
          >
            <div className="flex min-w-0 gap-2">
              <Input
                ref={scanInputRef}
                value={scanUrl}
                onChange={(event) => setScanUrl(event.target.value)}
                placeholder={chatCopy.startPlaceholder}
                aria-label={chatCopy.startLabel}
                disabled={loading}
                className="min-w-0 w-auto flex-1"
              />
              <Button type="submit" loading={loading} disabled={!scanUrl.trim()}>{chatCopy.startAction}</Button>
            </div>
            {scanError ? <p role="alert" className="text-xs text-destructive">{scanError}</p> : null}
            <button type="button" className="min-h-11 text-xs text-muted-foreground hover:text-foreground" onClick={() => setNewScan(false)}>
              {chatCopy.returnToReport}
            </button>
          </form>
        ) : historyError && canChat ? (
          <div className="space-y-3 border-t border-border/40 p-3">
            <p role="alert" className="text-xs text-destructive">{historyError}</p>
            <Button variant="outline" className="w-full" onClick={() => void loadConversation()}>{chatCopy.retry}</Button>
          </div>
        ) : meta.exhausted && canChat ? (
          <div className="space-y-3 border-t border-border/40 p-3">
            <p className="text-xs text-muted-foreground">{chatCopy.allowanceBody}</p>
            <Button asChild className="w-full"><Link href="/pricing">{chatCopy.allowanceAction}</Link></Button>
          </div>
        ) : (
          <form
            className="border-t border-border/40 p-2"
            onSubmit={(event) => { event.preventDefault(); void send(input) }}
          >
            {canChat ? (
              <div className="mb-2 flex flex-wrap gap-1.5 px-1">
                {[chatCopy.cannedFirst, chatCopy.cannedExplain].filter(Boolean).map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    className="rounded-[var(--radius-control)] bg-muted/55 px-2.5 py-1.5 text-2xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                    onClick={() => void send(chip)}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="flex min-w-0 items-center gap-2">
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={
                  canChat
                    ? chatCopy.placeholder
                    : gateReason === 'sign-in'
                      ? chatCopy.sendPlaceholder
                      : chatCopy.notOwner
                }
                disabled={
                  loading ||
                  (canChat && !meta.available) ||
                  (!canChat && gateReason === 'owner')
                }
                className="min-h-11 min-w-0 flex-1 text-sm"
                aria-label={
                  canChat
                    ? chatCopy.placeholder
                    : gateReason === 'sign-in'
                      ? chatCopy.sendPlaceholder
                      : chatCopy.notOwner
                }
              />
              <Button
                type="submit"
                size="icon"
                className="h-11 w-11 shrink-0"
                loading={loading}
                disabled={
                  loading ||
                  (canChat && (!input.trim() || !meta.available)) ||
                  (!canChat && gateReason === 'owner')
                }
                aria-label={
                  canChat
                    ? chatCopy.send
                    : gateReason === 'sign-in'
                      ? chatCopy.notSignedIn
                      : chatCopy.notOwner
                }
              >
                <ArrowUp className="h-4 w-4" aria-hidden />
              </Button>
            </div>
            {canChat && remainingLabel ? (
              <p className="mt-1 px-1 text-right font-mono text-2xs text-muted-foreground">{remainingLabel}</p>
            ) : null}
          </form>
        )}
      </section>
      <ReportClaimDialog
        open={authGate ? false : claimOpen}
        onOpenChange={setClaimOpen}
        nextPath={claimNextPath}
        from="report"
        auditId={auditId}
        reason={claimReason}
      />
    </TooltipProvider>
  )
}
