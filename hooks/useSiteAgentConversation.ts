'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { agentHistorySchema, type AgentCitation } from '@/lib/sites/agent-contract'
import { executeSiteAction, SiteActionError } from '@/lib/sites/client-actions'
import { SITE_AGENT_COPY as C } from '@/lib/marketing/copy/site-agent'

const intentSchema = z.object({ requestKey: z.string().min(1), message: z.string().min(1).max(2000) }).strict()
type Intent = z.infer<typeof intentSchema>
type History = z.infer<typeof agentHistorySchema>
type Turn = Intent & { reply?: History['messages'][number] }

/** The caller keys this hook's owner by Site and Flag so async results cannot cross contexts. */
export function useSiteAgentConversation<SiteId extends string | null>(siteId: SiteId, flagId: string | undefined, active: boolean) {
  const storageKey = siteId ? `fixflags:agent:${siteId}:${flagId ?? 'site'}` : null
  const draftKey = storageKey ? `${storageKey}:draft` : null
  const [question, setQuestion] = useState('')
  const [intent, setIntent] = useState<Intent | null>(null)
  const [history, setHistory] = useState<History | null>(null)
  const [turns, setTurns] = useState<Turn[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [error, setError] = useState<SiteActionError | null>(null)
  const read = useRef<AbortController | null>(null)
  const pending = useRef(false)
  const alive = useRef(false)
  const intentRef = useRef<Intent | null>(null)

  const saveIntent = useCallback((value: Intent | null) => {
    intentRef.current = value
    setIntent(value)
    if (!storageKey) return
    try {
      if (value) sessionStorage.setItem(storageKey, JSON.stringify(value))
      else sessionStorage.removeItem(storageKey)
    } catch { /* In-memory ownership retains an interrupted request. */ }
  }, [storageKey])

  const changeQuestion = useCallback((value: string) => {
    setQuestion(value)
    if (!draftKey) return
    try { sessionStorage.setItem(draftKey, value) } catch { /* Keep the in-memory draft. */ }
  }, [draftKey])

  useEffect(() => {
    alive.current = true
    if (!storageKey || !draftKey) return () => { alive.current = false; read.current?.abort() }
    try {
      const saved = intentSchema.safeParse(JSON.parse(sessionStorage.getItem(storageKey) ?? 'null'))
      if (saved.success) {
        intentRef.current = saved.data
        setIntent(saved.data)
        setTurns([saved.data])
        setQuestion(saved.data.message)
      } else setQuestion(sessionStorage.getItem(draftKey) ?? '')
    } catch { /* No stored draft is available. */ }
    return () => { alive.current = false; read.current?.abort() }
  }, [storageKey, draftKey])

  const validateCitations = useCallback((citations: AgentCitation[]) => {
    if (citations.some(citation => !citation.href.startsWith(`/sites/${siteId}/`) && !citation.href.startsWith(`/sites/${siteId}?`))) {
      throw new SiteActionError(C.invalid)
    }
  }, [siteId])

  const loadHistory = useCallback(async () => {
    if (!siteId) return
    read.current?.abort()
    const request = new AbortController()
    read.current = request
    setLoading(true)
    setHistoryError(null)
    try {
      const response = await fetch(`/api/sites/${siteId}/agent`, { cache: 'no-store', signal: request.signal })
      if (!response.ok) throw new Error(C.historyFailed)
      const saved = agentHistorySchema.parse(await response.json())
      saved.messages.forEach(item => validateCitations(item.citations))
      if (request.signal.aborted || !alive.current) return
      setHistory(saved)
      setTurns(current => current.filter(turn => !saved.messages.some(item => item.role === 'assistant' &&
        (item.requestKey === turn.requestKey || item.id === turn.reply?.id))))
      const interrupted = intentRef.current
      if (interrupted && saved.messages.some(item => item.role === 'assistant' && item.requestKey === interrupted.requestKey)) {
        saveIntent(null)
        changeQuestion('')
        setError(null)
      }
    } catch {
      if (!request.signal.aborted && alive.current) setHistoryError(C.historyFailed)
    } finally {
      if (!request.signal.aborted && alive.current) setLoading(false)
    }
  }, [siteId, validateCitations, saveIntent, changeQuestion])

  useEffect(() => {
    if (active && !pending.current) void loadHistory()
    return () => read.current?.abort()
  }, [active, loadHistory])

  async function send() {
    if (!siteId || pending.current || (!intentRef.current && (!history || loading || historyError)) || !question.trim()) return
    pending.current = true
    read.current?.abort()
    setLoading(false)
    setBusy(true)
    setError(null)
    const submitted = intentRef.current ?? { requestKey: `web:${crypto.randomUUID()}`, message: question.trim() }
    saveIntent(submitted)
    setTurns(current => current.some(turn => turn.requestKey === submitted.requestKey) ? current : [...current, submitted])
    try {
      const body = await executeSiteAction(`/api/sites/${siteId}/agent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': submitted.requestKey },
        body: JSON.stringify({ message: submitted.message, ...(flagId ? { flagId } : {}) }),
      }, 'agentReply')
      validateCitations(body.citations)
      if (!alive.current) return
      setTurns(current => current.map(turn => turn.requestKey === submitted.requestKey ? { ...turn, reply: {
        id: body.messageId, role: 'assistant', content: body.reply, citations: body.citations,
        createdAt: body.createdAt, flagId: flagId ?? null, requestKey: submitted.requestKey,
      } } : turn))
      saveIntent(null)
      changeQuestion('')
      await loadHistory()
    } catch (failure) {
      if (alive.current) setError(failure instanceof SiteActionError ? failure : new SiteActionError(C.invalid))
    } finally {
      pending.current = false
      if (alive.current) setBusy(false)
    }
  }

  const visibleMessages = (history?.messages ?? []).filter(item => !flagId || item.flagId === flagId)
  const messages = [...visibleMessages]
  for (const turn of turns) {
    if (!visibleMessages.some(item => item.role === 'user' && item.requestKey === turn.requestKey)) messages.push({
      id: `local:${turn.requestKey}`, role: 'user', content: turn.message, citations: [],
      createdAt: '', flagId: flagId ?? null, requestKey: turn.requestKey,
    })
    if (turn.reply && !messages.some(item => item.id === turn.reply!.id)) messages.push(turn.reply)
  }

  return { question, changeQuestion, intent, messages, loading, busy, historyError, error, send, loadHistory,
    canSend: Boolean(siteId) && !busy && Boolean(question.trim()) && (Boolean(intent) || Boolean(history && !loading && !historyError)),
    newMessage: () => { saveIntent(null); setError(null) }, siteId }
}

export type SiteAgentConversation = ReturnType<typeof useSiteAgentConversation<string>>
