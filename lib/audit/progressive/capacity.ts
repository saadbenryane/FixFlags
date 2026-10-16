import { MAX_TASKS_PER_AUDIT, TaskFailure } from './contracts'

export class BoundedSemaphore {
  private active = 0
  private readonly waiting: Array<{ grant: () => void; reject: (error: Error) => void; priority: number; signal?: AbortSignal; abort?: () => void }> = []
  constructor(readonly capacity: number, readonly maxQueued = MAX_TASKS_PER_AUDIT) {
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 64) throw new Error('Invalid execution capacity')
    if (!Number.isInteger(maxQueued) || maxQueued < 0 || maxQueued > MAX_TASKS_PER_AUDIT) throw new Error('Invalid execution queue bound')
  }
  get running() { return this.active }
  get queued() { return this.waiting.length }
  async acquire(signal?: AbortSignal, priority = 0): Promise<() => void> {
    if (signal?.aborted) throw new Error('Execution cancelled before resource admission')
    return new Promise((resolve, reject) => {
      const entry = { grant: () => {
        if (entry.abort) signal?.removeEventListener('abort', entry.abort)
        this.active++
        let released = false
        resolve(() => {
          if (released) return
          released = true; this.active--
          this.waiting.shift()?.grant()
        })
      }, reject, signal, priority, abort: undefined as (() => void) | undefined }
      entry.abort = () => {
        const index = this.waiting.indexOf(entry)
        if (index >= 0) this.waiting.splice(index, 1)
        reject(new Error('Execution cancelled while awaiting capacity'))
      }
      if (this.active < this.capacity) entry.grant()
      else {
        if (this.waiting.length >= this.maxQueued) {
          reject(new TaskFailure('RESOURCE_QUEUE_FULL', true))
          return
        }
        this.waiting.push(entry)
        this.waiting.sort((left, right) => right.priority - left.priority)
        signal?.addEventListener('abort', entry.abort, { once: true })
        if (signal?.aborted) entry.abort()
      }
    })
  }
  async run<T>(work: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    const release = await this.acquire(signal)
    try { return await work() } finally { release() }
  }
}
export function configuredLimit(name: string, defaultValue: number, environment = process.env) {
  const raw = environment[name]
  if (raw === undefined) return defaultValue
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 1 || value > 64) throw new Error(name + ' must be an integer between 1 and 64')
  return value
}
export const browserCapacity = new BoundedSemaphore(configuredLimit('AUDIT_BROWSER_CONTEXT_LIMIT', 2))
export const publicHttpCapacity = new BoundedSemaphore(configuredLimit('AUDIT_HTTP_REQUEST_LIMIT', 4))
// Graphs are durable orchestration, not physical resource slots. A bounded
// window lets independent queues make progress while another resource waits.
export const ACTIVE_GRAPH_LIMIT = configuredLimit('AUDIT_ACTIVE_GRAPH_LIMIT', 8)
