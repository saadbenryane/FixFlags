import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { SWRConfig } from 'swr'
import { afterEach, expect, it, vi } from 'vitest'
import { CLIENT_REQUEST_TIMEOUT_MS } from '@/lib/api/client-request'
import { useAdminSupportMessages, useAdminSupportSession, useAdminSupportSessions, useSupportMessages, useSupportSession } from '../useSupportPolling'

function wrapper({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false, revalidateOnFocus: false }}>{children}</SWRConfig>
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

it.each(['connection', 'body'] as const)('releases a support read stalled during %s and allows a fresh retry', async stage => {
  vi.useFakeTimers()
  let signal: AbortSignal | undefined
  const fetcher = vi.fn((_url: RequestInfo | URL, options?: RequestInit) => {
    signal = options?.signal ?? undefined
    return stage === 'connection' ? new Promise<Response>(() => {})
      : Promise.resolve({ ok: true, json: () => new Promise(() => {}) } as Response)
  })
  vi.stubGlobal('fetch', fetcher)
  const rendered = renderHook(() => ({ ...useSupportMessages('session', true) }), { wrapper })
  try {
    expect(fetcher).toHaveBeenCalledOnce()
    expect(rendered.result.current.isValidating).toBe(true)
    await act(async () => { await vi.advanceTimersByTimeAsync(CLIENT_REQUEST_TIMEOUT_MS) })
    expect(rendered.result.current.error).toBeInstanceOf(Error)
    expect(rendered.result.current.isValidating).toBe(false)
    expect(signal?.aborted).toBe(true)
    fetcher.mockResolvedValue(Response.json({ messages: [] }))
    await act(async () => { await rendered.result.current.mutate() })
    expect(rendered.result.current.error).toBeUndefined()
    expect(rendered.result.current.data).toEqual({ messages: [] })
  } finally { rendered.unmount() }
})

const session = { id: 'session', status: 'OPEN', unreadByVisitor: 0, unreadByAgent: 0, createdAt: '2026-11-03T12:00:00Z', project: null }
it.each([
  { name: 'visitor session', useRead: () => useSupportSession(true), payload: { session } },
  { name: 'visitor messages', useRead: () => useSupportMessages('session', true), payload: { messages: [] } },
  { name: 'admin sessions', useRead: () => useAdminSupportSessions(), payload: { sessions: [session] } },
  { name: 'admin messages', useRead: () => useAdminSupportMessages('session'), payload: { messages: [] } },
  { name: 'admin session', useRead: () => useAdminSupportSession('session'), payload: { session } },
])('preserves the $name read contract', async ({ useRead, payload }) => {
  const fetcher = vi.fn().mockResolvedValue(Response.json(payload))
  vi.stubGlobal('fetch', fetcher)
  const rendered = renderHook(() => ({ ...useRead() }), { wrapper })
  try {
    await waitFor(() => expect(rendered.result.current.data).toEqual(payload))
    expect(fetcher).toHaveBeenCalledOnce()
  } finally { rendered.unmount() }
})

it('keeps malformed JSON unavailable instead of publishing a successful empty read', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{', { status: 200 })))
  const rendered = renderHook(() => ({ ...useSupportMessages('session', true) }), { wrapper })
  try {
    await waitFor(() => expect(rendered.result.current.error).toBeInstanceOf(Error))
    expect(rendered.result.current.data).toBeUndefined()
  } finally { rendered.unmount() }
})
