'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { prepareRepairPrompt, type PreparedRepairPrompt, type RepairPromptScope } from '@/lib/sites/repair-prompt-client'
import { SiteActionError } from '@/lib/sites/client-actions'
import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'

class DiscardedPromptRead extends Error {}

/** Preview and copying share one prepared revision, with bounded identity-owned reads. */
export function usePreparedRepairPrompt(scope: RepairPromptScope, enabled: boolean, prefetch: boolean) {
  const scopeKey = JSON.stringify(scope)
  const key = `${enabled}:${scopeKey}`
  const active = useRef<string | null>(key)
  const requests = useRef(new Set<AbortController>())
  const prepared = useRef<{ key: string; value: PreparedRepairPrompt } | null>(null)
  const inFlight = useRef<{ key: string; attempt: object; promise: Promise<PreparedRepairPrompt> } | null>(null)
  const [state, setState] = useState<{ key: string; value?: PreparedRepairPrompt; error?: string } | null>(null)
  const [review, setReview] = useState<{ key: string; prompt: string } | null>(null)
  useLayoutEffect(() => {
    active.current = key
    const pending = requests.current
    return () => { active.current = null; for (const request of pending) request.abort(); pending.clear(); inFlight.current = null }
  }, [key])
  const read = useCallback((): Promise<PreparedRepairPrompt> => {
    if (inFlight.current?.key === key) return inFlight.current.promise
    const attempt = {}
    const promise = (async () => {
      if (!enabled || active.current !== key) throw new SiteActionError(C.promptInterrupted)
      const controller = new AbortController()
      requests.current.add(controller)
      const timer = setTimeout(() => controller.abort(new DOMException(C.promptInterrupted, 'TimeoutError')), 15_000)
      try {
        const value = await prepareRepairPrompt(JSON.parse(scopeKey) as RepairPromptScope, controller.signal)
        if (active.current !== key || controller.signal.aborted && controller.signal.reason?.name !== 'TimeoutError') throw new DiscardedPromptRead()
        if (controller.signal.aborted) throw new SiteActionError(C.promptInterrupted)
        return value
      } catch (error) {
        if (active.current !== key || controller.signal.aborted && controller.signal.reason?.name !== 'TimeoutError') throw new DiscardedPromptRead()
        throw error
      } finally {
        clearTimeout(timer); requests.current.delete(controller)
        if (inFlight.current?.attempt === attempt) inFlight.current = null
      }
    })()
    inFlight.current = { key, attempt, promise }
    return promise
  }, [enabled, key, scopeKey])
  const publish = useCallback((value: PreparedRepairPrompt) => {
    prepared.current = { key, value }; setState({ key, value })
  }, [key])
  const prepare = useCallback(async () => { const value = await read(); publish(value); return value }, [read, publish])
  useEffect(() => {
    if (!enabled || !prefetch) return
    void prepare().catch(error => { if (!(error instanceof DiscardedPromptRead) && active.current === key) setState({ key, error: error instanceof Error ? error.message : C.bundleNotReady }) })
  }, [enabled, prefetch, prepare, key])
  async function forCopy() {
    const value = await read()
    const previous = prepared.current?.key === key ? prepared.current.value : null
    publish(value)
    if (previous && (previous.prompt !== value.prompt || JSON.stringify(previous.tasks) !== JSON.stringify(value.tasks))) {
      setReview({ key, prompt: value.prompt })
      throw new SiteActionError(C.promptChanged, 409, 'REPAIR_TASK_CHANGED')
    }
    return value
  }
  return { prepare, forCopy, preview: enabled && state?.key === key ? state.value?.prompt ?? null : null,
    unavailable: state?.key === key ? state.error ?? null : null,
    review: review?.key === key ? review.prompt : null, closeReview: () => setReview(null) }
}
