'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createSiteActionController, SiteActionError, type SiteActionCompletion } from '@/lib/sites/client-actions'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { withClientDeadline } from '@/lib/api/client-request'

type Controller = ReturnType<typeof createSiteActionController>
type Feedback = { busy: boolean; message: string | null; error: SiteActionError | null }
type Owner = { controller: Controller; abort: AbortController }
const idle = (): Feedback => ({ busy: false, message: null, error: null })

/** A scope owns feedback and callbacks. The namespace separately preserves retry keys.
 * Retiring a view never establishes whether a server-side command committed. */
export function useSiteAction({ namespace, scope = namespace }: { namespace?: string; scope?: string } = {}) {
  const { controller } = useMemo(() => ({ scope, controller: createSiteActionController(namespace) }), [namespace, scope])
  const active = useRef<Owner | null>(null)
  const [state, setState] = useState(() => ({ controller, ...idle() }))
  const feedback = state.controller === controller ? state : idle()
  useLayoutEffect(() => {
    const owner = { controller, abort: new AbortController() }
    active.current = owner
    return () => { owner.abort.abort(); if (active.current === owner) active.current = null }
  }, [controller])

  const current = (owner: Owner) => active.current === owner && !owner.abort.signal.aborted
  function publish(owner: Owner, patch: Partial<Feedback>) {
    if (!current(owner)) return
    setState(previous => ({ ...(previous.controller === owner.controller ? previous : idle()), controller: owner.controller, ...patch }))
  }

  async function submit<T>(mutation: (signal: AbortSignal) => Promise<T>, success: (data: T, signal: AbortSignal) => string | null,
    refresh?: (signal: AbortSignal) => Promise<unknown> | void): Promise<SiteActionCompletion<T> | { kind: 'retired' }> {
    const owner = active.current
    if (!owner || owner.controller !== controller || !current(owner)) return { kind: 'retired' }
    if (controller.pending) return { kind: 'busy' as const }
    publish(owner, { busy: true, message: null, error: null })
    try {
      const result = await withClientDeadline(signal => controller.submit(async () => {
        const data = await mutation(signal)
        if (!current(owner)) throw new SiteActionError(SITE_ACTION_COPY.interrupted)
        return data
      }, refresh ? async () => { if (current(owner)) await refresh(signal) } : undefined,
      data => { if (current(owner)) publish(owner, { message: success(data, signal) }) }), owner.abort.signal, null)
      if (!current(owner)) return { kind: 'retired' }
      if (result.kind === 'refused') publish(owner, { error: result.error, message: result.error.message })
      if (result.kind === 'saved_refresh_pending') publish(owner, { message: SITE_ACTION_COPY.refreshPending })
      return result
    } catch {
      if (!current(owner)) return { kind: 'retired' }
      const error = new SiteActionError(SITE_ACTION_COPY.interrupted)
      publish(owner, { error, message: error.message })
      return { kind: 'refused', error }
    } finally { publish(owner, { busy: false }) }
  }
  return { submit, busy: feedback.busy, message: feedback.message, error: feedback.error,
    isPending: () => active.current?.controller === controller && controller.pending,
    requestKey: controller.requestKey, completeIntent: controller.completeIntent, clearFeedback: () => {
      const owner = active.current
      if (owner?.controller === controller) publish(owner, { message: null, error: null })
    } }
}
