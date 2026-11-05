import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { siteAgentConversationKey, useSiteAgentConversation } from '../useSiteAgentConversation'
import { SITE_AGENT_COPY as C } from '@/lib/marketing/copy/site-agent'

const empty = { threadId: 'thread', messages: [] }
const receipt = { reply: 'The recorded check found an empty cart.', citations: [{
  type: 'flag', id: 'flag', label: 'Cart evidence', href: '/sites/site/flags/flag',
}], threadId: 'thread', messageId: 'reply', createdAt: '2026-11-03T09:00:00Z' }
function mount() { return renderHook(({ active }) => useSiteAgentConversation('site', undefined, active, 'owner'), { initialProps: { active: true } }) }
async function advance(ms = 0) { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }

beforeEach(() => { vi.useFakeTimers(); sessionStorage.clear() })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

it('does not read, persist, or submit a private conversation without account identity', async () => {
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  const { result } = renderHook(() => useSiteAgentConversation('site', undefined, true, null))
  act(() => result.current.changeQuestion('A draft without an account'))
  await act(async () => { await result.current.loadHistory(); await result.current.send() })
  expect(result.current.canSend).toBe(false)
  expect(sessionStorage.length).toBe(0)
  expect(fetcher).not.toHaveBeenCalled()
})

it.each(['headers', 'body'] as const)('bounds initial history through stalled %s, retains the draft, and permits an explicit retry', async phase => {
  let finish!: (value: unknown) => void
  let signal!: AbortSignal
  const fetcher = vi.fn().mockImplementationOnce((_url, options) => {
    signal = options.signal
    if (phase === 'headers') return new Promise<Response>(resolve => { finish = body => resolve(Response.json(body)) })
    return Promise.resolve({ ok: true, json: () => new Promise(resolve => { finish = resolve }) } as Response)
  }).mockImplementation(async () => Response.json(empty))
  vi.stubGlobal('fetch', fetcher)
  const { result } = mount()
  act(() => result.current.changeQuestion('What should I fix first?'))
  await advance(14_999)
  expect(result.current.loading).toBe(true)
  expect(result.current.canSend).toBe(false)
  await act(async () => { await result.current.send() })
  expect(fetcher).toHaveBeenCalledOnce()
  await advance(1)
  expect(signal.aborted).toBe(true)
  expect(result.current.loading).toBe(false)
  expect(result.current.historyError).toBe(C.historyFailed)
  expect(result.current.question).toBe('What should I fix first?')
  await act(async () => { await result.current.loadHistory() })
  expect(result.current.historyError).toBeNull()
  expect(result.current.canSend).toBe(true)
  await act(async () => { finish({ threadId: 'old', messages: [{ id: 'late', role: 'assistant', content: 'Late answer', citations: [], createdAt: receipt.createdAt }] }) })
  expect(result.current.messages).toEqual([])
  expect(result.current.question).toBe('What should I fix first?')
  expect(fetcher).toHaveBeenCalledTimes(2)
})

it('releases an accepted reply while history is pending and protects the next send from that old read', async () => {
  let finishHistory!: (response: Response) => void
  let finishReply!: (response: Response) => void
  let historySignal!: AbortSignal
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json(empty))
    .mockResolvedValueOnce(Response.json(receipt))
    .mockImplementationOnce((_url, options) => {
      historySignal = options.signal
      return new Promise<Response>(resolve => { finishHistory = resolve })
    })
    .mockImplementationOnce(() => new Promise<Response>(resolve => { finishReply = resolve }))
    .mockImplementation(async () => Response.json(empty))
  vi.stubGlobal('fetch', fetcher)
  const { result } = mount()
  await advance()
  act(() => result.current.changeQuestion('Why was the cart flagged?'))
  await act(async () => { await result.current.send() })
  expect(result.current.messages.map(item => item.content)).toEqual(['Why was the cart flagged?', receipt.reply])
  expect(result.current.busy).toBe(false)
  expect(result.current.loading).toBe(true)
  expect(result.current.intent).toBeNull()
  act(() => result.current.changeQuestion('What should I change?'))
  expect(result.current.canSend).toBe(true)
  let second!: ReturnType<typeof result.current.send>
  act(() => { second = result.current.send() })
  expect(historySignal.aborted).toBe(true)
  await act(async () => { finishHistory(Response.json(empty)) })
  expect(result.current.question).toBe('What should I change?')
  expect(result.current.intent?.message).toBe('What should I change?')
  expect(result.current.messages.map(item => item.content)).toContain(receipt.reply)
  await act(async () => { finishReply(Response.json({ ...receipt, messageId: 'second-reply', reply: 'Restore the cart handler.' })); await second })
  expect(result.current.busy).toBe(false)
  expect(result.current.messages.filter(item => item.role === 'assistant')).toHaveLength(2)
  expect(fetcher.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(2)
})

it('keeps accepted replies usable and allows the next question after history reconciliation fails', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json(empty))
    .mockResolvedValueOnce(Response.json(receipt))
    .mockResolvedValueOnce(Response.json({}, { status: 503 }))
    .mockResolvedValueOnce(Response.json({ ...receipt, messageId: 'second-reply', reply: 'Keep monitoring after publishing.' }))
    .mockImplementation(async () => Response.json(empty))
  vi.stubGlobal('fetch', fetcher)
  const { result } = mount()
  await advance()
  act(() => result.current.changeQuestion('Explain the cart evidence.'))
  await act(async () => { await result.current.send() })
  expect(result.current.historyError).toBe(C.historyFailed)
  expect(result.current.messages.some(item => item.content === receipt.reply)).toBe(true)
  expect(result.current.error).toBeNull()
  act(() => result.current.changeQuestion('What comes next?'))
  expect(result.current.canSend).toBe(true)
  await act(async () => { await result.current.send() })
  expect(result.current.messages.some(item => item.content === 'Keep monitoring after publishing.')).toBe(true)
  expect(result.current.historyError).toBeNull()
})

it('recovers an interrupted exact intent before history is available without reposting it automatically', async () => {
  const intent = { requestKey: 'web:original', message: 'Explain the original observation.' }
  sessionStorage.setItem(siteAgentConversationKey('owner', 'site')!, JSON.stringify(intent))
  const fetcher = vi.fn().mockImplementationOnce(() => new Promise<Response>(() => {}))
    .mockResolvedValueOnce(Response.json(receipt))
    .mockImplementation(async () => Response.json(empty))
  vi.stubGlobal('fetch', fetcher)
  const { result } = mount()
  await advance(15_000)
  expect(result.current.historyError).toBe(C.historyFailed)
  expect(result.current.canSend).toBe(true)
  expect(fetcher).toHaveBeenCalledOnce()
  await act(async () => { await result.current.send() })
  expect(fetcher.mock.calls[1][1]).toEqual(expect.objectContaining({ method: 'POST',
    headers: expect.objectContaining({ 'Idempotency-Key': intent.requestKey }), body: JSON.stringify({ message: intent.message }),
  }))
  expect(result.current.intent).toBeNull()
  expect(result.current.busy).toBe(false)
})

it('retains an unconfirmed send and its key when the command response times out', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json(empty))
    .mockImplementationOnce(() => new Promise<Response>(() => {}))
    .mockResolvedValueOnce(Response.json(receipt))
    .mockImplementation(async () => Response.json(empty))
  vi.stubGlobal('fetch', fetcher)
  const { result } = mount()
  await advance()
  act(() => result.current.changeQuestion('Explain this evidence.'))
  let send!: ReturnType<typeof result.current.send>
  act(() => { send = result.current.send() })
  const originalKey = result.current.intent!.requestKey
  // Reply generation has the existing two-minute command window.
  await advance(120_000)
  await send
  expect(result.current.busy).toBe(false)
  expect(result.current.intent?.requestKey).toBe(originalKey)
  expect(result.current.question).toBe('Explain this evidence.')
  expect(result.current.messages.filter(item => item.role === 'assistant')).toHaveLength(0)
  await act(async () => { await result.current.send() })
  expect(fetcher.mock.calls[2][1].headers['Idempotency-Key']).toBe(originalKey)
  expect(result.current.messages.filter(item => item.role === 'assistant')).toHaveLength(1)
})

it('replaces a closed-panel read on reopening and ignores its late result', async () => {
  let finish!: (response: Response) => void
  let signal!: AbortSignal
  const fetcher = vi.fn().mockImplementationOnce((_url, options) => {
    signal = options.signal
    return new Promise<Response>(resolve => { finish = resolve })
  }).mockImplementation(async () => Response.json(empty))
  vi.stubGlobal('fetch', fetcher)
  const { result, rerender } = mount()
  rerender({ active: false })
  expect(signal.aborted).toBe(true)
  rerender({ active: true })
  await advance()
  expect(result.current.loading).toBe(false)
  expect(result.current.historyError).toBeNull()
  await act(async () => { finish(Response.json({ threadId: 'old', messages: [{ id: 'late', role: 'assistant', content: 'Late answer', citations: [], createdAt: receipt.createdAt }] })) })
  expect(result.current.messages).toEqual([])
  expect(fetcher).toHaveBeenCalledTimes(2)
})
