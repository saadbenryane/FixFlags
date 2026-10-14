import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { evidence } from '../../search/__tests__/fixtures'

const mocks = vi.hoisted(() => ({ workers: [] as Array<{
  emit: (event: string, value: unknown) => boolean; posts: unknown[];
}>, terminate: vi.fn(), reply: true }))
vi.mock('node:worker_threads', async () => {
  const { EventEmitter } = await import('node:events')
  return { Worker: class extends EventEmitter {
    posts: unknown[] = []
    constructor() { super(); mocks.workers.push(this) }
    ref() { return this }
    unref() { return this }
    postMessage(input: unknown) {
      this.posts.push(input)
      if (mocks.reply) void Promise.resolve().then(() => this.emit('message', []))
    }
    terminate() { return mocks.terminate() }
  } }
})
import { closeParserWorker, evaluateSearchIsolated } from '../cpu'

beforeEach(() => {
  vi.clearAllMocks(); mocks.workers.length = 0; mocks.reply = true
  mocks.terminate.mockResolvedValue(0)
})
afterEach(async () => { await closeParserWorker(); vi.useRealTimers() })
const evaluate = (deadline = Date.now() + 30_000) => evaluateSearchIsolated(evidence(), null, deadline, ['crawl'])

describe('bounded parser lifecycle', () => {
  it('reuses one live worker for independent sequential requests', async () => {
    await evaluate(); await evaluate()
    expect(mocks.workers).toHaveLength(1)
    expect(mocks.workers[0].posts).toHaveLength(2)
    expect(mocks.terminate).not.toHaveBeenCalled()
    await closeParserWorker()
    expect(mocks.terminate).toHaveBeenCalledOnce()
  })

  it('terminates an idle worker and starts a fresh one for later work', async () => {
    vi.useFakeTimers()
    await evaluate()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(mocks.terminate).toHaveBeenCalledOnce()
    await evaluate()
    expect(mocks.workers).toHaveLength(2)
  })

  it('waits for failed worker termination before admitting the next request', async () => {
    mocks.reply = false
    let finishTermination!: (code: number) => void
    mocks.terminate.mockReturnValueOnce(new Promise<number>(resolve => { finishTermination = resolve }))
    const first = evaluate()
    const rejected = expect(first).rejects.toMatchObject({ code: 'PARSER_CRASH' })
    await vi.waitFor(() => expect(mocks.workers).toHaveLength(1))
    mocks.workers[0].emit('error', new Error('Fixture parser crash'))
    const next = evaluate()
    try {
      await Promise.resolve()
      expect(mocks.workers).toHaveLength(1)
    } finally {
      mocks.reply = true
      finishTermination(1)
      await rejected
      await next
    }
    expect(mocks.workers).toHaveLength(2)
  })

  it('discards a timed-out worker so its late result cannot satisfy another request', async () => {
    vi.useFakeTimers()
    mocks.reply = false
    const first = evaluate(Date.now() + 1000)
    const rejected = expect(first).rejects.toMatchObject({ code: 'PARSER_DEADLINE' })
    await vi.advanceTimersByTimeAsync(1000)
    await rejected
    const old = mocks.workers[0]
    const next = evaluate()
    await vi.advanceTimersByTimeAsync(0)
    expect(mocks.workers).toHaveLength(2)
    old.emit('message', [{ stale: true }])
    mocks.workers[1].emit('message', [])
    expect(await next).toEqual([])
  })
})
