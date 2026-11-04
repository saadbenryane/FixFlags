import { beforeEach, describe, expect, it, vi } from 'vitest'

const boundary = vi.hoisted(() => ({ close: vi.fn(), disconnect: vi.fn(), construct: vi.fn(),
  status: 'ready', ended: undefined as (() => void) | undefined }))
vi.mock('bullmq', () => {
  class Resource {
    close = boundary.close
    constructor(...args: unknown[]) { boundary.construct(...args) }
  }
  return { Worker: Resource, Queue: Resource }
})
vi.mock('../redis', () => ({
  createWorkerRedis: client,
  createQueueRedis: client,
}))
function client() {
  return { get status() { return boundary.status }, disconnect: boundary.disconnect,
    once(_event: string, callback: () => void) { boundary.ended = callback } }
}
import { createOwnedQueue, createOwnedWorker } from '../bullmq-ownership'

beforeEach(() => {
  vi.resetAllMocks(); boundary.status = 'ready'; boundary.ended = undefined
  boundary.close.mockResolvedValue(undefined)
  boundary.disconnect.mockImplementation(() => { boundary.status = 'end' })
})
describe('dedicated BullMQ Redis ownership', () => {
  for (const [kind, create] of [
    ['worker', () => createOwnedWorker('fixture', async () => {}, { concurrency: 1 })],
    ['producer', () => createOwnedQueue('fixture')],
  ] as const) {
    it('drains a ' + kind + ' once before disconnecting its client', async () => {
      let finish!: () => void
      boundary.close.mockReturnValue(new Promise<void>(resolve => { finish = resolve }))
      const resource = create(), closing = resource.close()
      expect(resource.close()).toBe(closing)
      expect(boundary.close).toHaveBeenCalledOnce()
      expect(boundary.disconnect).not.toHaveBeenCalled()
      finish(); await closing
      expect(boundary.disconnect).toHaveBeenCalledOnce()
    })
    it('releases a ' + kind + ' client if native construction fails', () => {
      boundary.construct.mockImplementation(() => { throw new Error('Invalid native configuration') })
      expect(create).toThrow('Invalid native configuration')
      expect(boundary.disconnect).toHaveBeenCalledOnce()
    })
    it('retains ownership when native ' + kind + ' drain cannot be established', async () => {
      boundary.close.mockRejectedValue(new Error('Drain incomplete'))
      await expect(create().close()).rejects.toThrow('Drain incomplete')
      expect(boundary.disconnect).not.toHaveBeenCalled()
    })
  }
  it('preserves an explicit forced worker close', async () => {
    const worker = createOwnedWorker('fixture', async () => {}, { concurrency: 1 })
    await worker.close(true)
    expect(boundary.close).toHaveBeenCalledWith(true)
    expect(boundary.disconnect).toHaveBeenCalledOnce()
  })
  it('does not finish shutdown until the supplied client has physically ended', async () => {
    boundary.disconnect.mockImplementation(() => {})
    let settled = false
    const closing = createOwnedWorker('fixture', async () => {}, { concurrency: 1 }).close().then(() => { settled = true })
    await Promise.resolve(); await Promise.resolve()
    expect(boundary.disconnect).toHaveBeenCalledOnce()
    expect(settled).toBe(false)
    expect(boundary.ended).toBeTypeOf('function')
    boundary.status = 'end'; boundary.ended!(); await closing
    expect(settled).toBe(true)
  })
  it('cancels a disconnected retrying client without waiting for a second end event', async () => {
    boundary.status = 'reconnecting'
    boundary.disconnect.mockImplementation(() => {})
    await createOwnedQueue('fixture').close()
    expect(boundary.disconnect).toHaveBeenCalledOnce()
    expect(boundary.ended).toBeUndefined()
  })
})
