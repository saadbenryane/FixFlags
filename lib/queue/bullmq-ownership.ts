import { Queue, Worker, type Processor, type QueueOptions, type WorkerOptions } from 'bullmq'
import type Redis from 'ioredis'
import { createQueueRedis, createWorkerRedis } from './redis'

/** BullMQ borrows supplied clients. Their creator retains ownership until the
 * native resource finishes its graceful drain or explicitly forced close.
 * Disconnect afterwards rather than queuing QUIT on an unavailable server. */
function ownConnection<T extends { close(force?: boolean): Promise<void> }>(connection: Redis, create: (client: Redis) => T): T {
  let resource: T
  try { resource = create(connection) }
  catch (error) { connection.disconnect(); throw error }
  const close = resource.close.bind(resource)
  let closing: Promise<void> | undefined
  resource.close = force => closing ??= close(force).then(async () => {
    // ioredis enters reconnecting only after its socket closes. Cancelling that
    // retry emits no new end event, so only a live/connecting client must wait.
    const retrying = connection.status === 'reconnecting'
    connection.disconnect()
    if (!retrying && connection.status !== 'end') await new Promise<void>(resolve => { connection.once('end', resolve) })
  })
  return resource
}

/** Only dedicated clients belong here. Shared producers retain their existing
 * process owner and must not be disconnected by one borrowed queue. */
export function createOwnedWorker(name: string, processor: Processor, options: Omit<WorkerOptions, 'connection'>) {
  return ownConnection(createWorkerRedis(), connection => new Worker(name, processor, { ...options, connection }))
}

export function createOwnedQueue(name: string, options: Omit<QueueOptions, 'connection'> = {}) {
  return ownConnection(createQueueRedis(), connection => new Queue(name, { ...options, connection }))
}

/** The native initialization promise never recovers after rejection. Retire
 * only that facade, keeping a borrowed Redis client available to its peers. */
export function createQueueProducer(name: string, {
  onError, connection, ...options
}: Omit<QueueOptions, 'connection' | 'skipWaitingForReady'> & { onError: (error: Error) => void; connection?: () => Redis }) {
  let current: Queue | undefined

  async function close(queue = current) {
    if (!queue) return
    await queue.close()
    if (current === queue) current = undefined
  }

  return {
    get() {
      if (current) return current
      // INFO still validates Redis, through the producer's command deadline.
      // Waiting separately for a ready event can outlive that deadline.
      const settings = { ...options, skipWaitingForReady: true }
      const queue = connection ? new Queue(name, { ...settings, connection: connection() }) : createOwnedQueue(name, settings)
      current = queue
      queue.on('error', onError)
      void queue.waitUntilReady().catch(async () => {
        try { await close(queue) }
        catch (error) { onError(error instanceof Error ? error : new Error(String(error))) }
        finally { if (current === queue) current = undefined }
      })
      return queue
    },
    close: () => close(),
  }
}
