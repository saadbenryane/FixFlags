import type { Browser, BrowserContext, BrowserContextOptions } from 'playwright'
import { browserCapacity } from '../progressive/capacity'
import { AuditDeadlineError } from '../pipeline-errors'
import { randomUUID } from 'node:crypto'
import { logger } from '@/lib/logger'

export const CONTEXT_SETUP_TIMEOUT_MS = 30_000

type ContextOwner = { contextId: string; openedAt: number; deadline?: number; signal: AbortSignal; scope: 'task' | 'execution' | 'standalone';
  state: 'preparing' | 'prepared' | 'closing' | 'close_failed' }
const contextOwners = new WeakMap<BrowserContext, ContextOwner>()

/** Operational lifecycle facts only. Never expose targets, credentials or tenant identifiers. */
export function auditContextDiagnostics(browser: Browser | null, now = Date.now()) {
  const contexts = browser?.isConnected() ? browser.contexts() : []
  const owners = contexts.flatMap(context => {
    const owner = contextOwners.get(context)
    return owner ? [{ contextId: owner.contextId, scope: owner.scope, state: owner.state, ageMs: Math.max(0, now - owner.openedAt),
      expired: owner.signal.aborted || owner.deadline !== undefined && now >= owner.deadline }] : []
  })
  return { ownedContexts: owners.length, unownedContexts: contexts.length - owners.length,
    expiredContexts: owners.filter(owner => owner.expired).length, reservedSlots: browserCapacity.running,
    waitingAllocations: browserCapacity.queued, owners }
}
export type AuditContextDiagnostics = ReturnType<typeof auditContextDiagnostics>

/** Logical cancellation never releases a context that Chromium may still own. */
export async function openAuditContext<T>(
  browser: Browser,
  contextOptions: BrowserContextOptions,
  lifetime: { deadline?: number; signal?: AbortSignal; priority?: number; scope?: ContextOwner['scope']; owner?: { auditId: string; taskId?: string; generation: number } },
  prepare: (context: BrowserContext, assertActive: () => void) => Promise<T>,
): Promise<T> {
  const deadline = new AbortController()
  const expire = () => deadline.abort(new AuditDeadlineError('browser page session'))
  // Callers without a task deadline still bound admission and page setup.
  // After setup, their explicit context closure owns the session lifetime.
  const hasDeadline = Number.isFinite(lifetime.deadline)
  const deadlineAt = hasDeadline ? lifetime.deadline! : Date.now() + CONTEXT_SETUP_TIMEOUT_MS
  let prepared = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const remaining = deadlineAt - Date.now()
  if (remaining <= 0) expire()
  else { timer = setTimeout(expire, remaining); timer.unref?.() }
  const signal = lifetime.signal ? AbortSignal.any([deadline.signal, lifetime.signal]) : deadline.signal
  const owner: ContextOwner = { contextId: randomUUID(), openedAt: Date.now(), deadline: hasDeadline ? deadlineAt : undefined, signal,
    scope: lifetime.scope ?? 'standalone', state: 'preparing' }
  const reason = () => signal.reason instanceof Error ? signal.reason : new Error('Browser capture cancelled')
  let release: () => void
  try { release = await browserCapacity.acquire(signal, lifetime.priority ?? 0) }
  catch (error) { clearTimeout(timer); throw signal.aborted ? reason() : error }

  let context: BrowserContext | undefined, released = false, stopped: Error | undefined
  let rejectStopped!: (error: Error) => void
  const cancelled = new Promise<never>((_, reject) => { rejectStopped = reject })
  const stop = (error: Error) => { stopped ??= error; rejectStopped(stopped) }
  const releaseOnce = () => {
    if (released) return
    released = true
    if (context) {
      contextOwners.delete(context)
      logger.info('Native browser context released', { contextId: owner.contextId, scope: owner.scope, ...lifetime.owner })
    }
    clearTimeout(timer)
    signal.removeEventListener('abort', onAbort)
    browser.off('disconnected', onDisconnected)
    release()
  }
  const onDisconnected = () => { stop(new Error('Audit browser disconnected')); releaseOnce() }
  let closing: Promise<void> | undefined
  const closeContext = () => {
    if (context && !closing) {
      owner.state = 'closing'
      closing = context.close().then(() => {
        // Playwright can acknowledge a second close before its first close ends.
        if (!released && (!browser.isConnected() || !browser.contexts().includes(context!))) releaseOnce()
      }, () => {
        owner.state = 'close_failed'
        logger.warn('Native browser context closure was not confirmed', { contextId: owner.contextId, scope: owner.scope, ...lifetime.owner })
        // A failed close cannot free a live native resource or close other Sites.
        if (!browser.isConnected()) releaseOnce()
      })
    }
  }
  const onAbort = () => { stop(reason()); closeContext() }
  const assertActive = () => {
    if ((hasDeadline || !prepared) && Date.now() >= deadlineAt) expire()
    if (signal.aborted) throw reason()
    if (stopped) throw stopped
  }
  browser.once('disconnected', onDisconnected)
  signal.addEventListener('abort', onAbort, { once: true })

  const opening = (async () => {
    try { assertActive() }
    catch (error) { releaseOnce(); throw error }
    try { context = await browser.newContext(contextOptions) }
    catch (error) { releaseOnce(); throw error }
    owner.openedAt = Date.now()
    contextOwners.set(context, owner)
    logger.info('Native browser context allocated', { contextId: owner.contextId, scope: owner.scope, ...lifetime.owner })
    context.once('close', () => { stop(new Error('Audit browser context closed')); releaseOnce() })
    try {
      assertActive()
      const value = await prepare(context, assertActive)
      assertActive()
      prepared = true
      owner.state = 'prepared'
      if (!hasDeadline) clearTimeout(timer)
      return value
    } catch (error) {
      stop(error instanceof Error ? error : new Error('Audit browser setup failed'))
      closeContext()
      throw error
    }
  })()
  try { return await Promise.race([opening, cancelled]) }
  catch (error) { closeContext(); throw error }
}
