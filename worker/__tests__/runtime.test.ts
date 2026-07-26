import { describe, expect, it, vi } from 'vitest'
import {
  createWorkerRuntime,
  type WorkerRuntimeDependencies,
} from '@/worker/runtime'

function dependencies(): WorkerRuntimeDependencies & {
  calls: string[]
  closeWorker: ReturnType<typeof vi.fn>
  exit: ReturnType<typeof vi.fn>
} {
  const calls: string[] = []
  const closeWorker = vi.fn(async () => {
    calls.push('worker:close')
  })
  const exit = vi.fn((code: number) => {
    calls.push(`exit:${code}`)
  })

  return {
    calls,
    closeWorker,
    exit,
    validateEnvironment: () => calls.push('env'),
    warmBrowser: async () => {
      calls.push('browser:warm')
    },
    readBrowserDiagnostics: () => {
      calls.push('browser:diagnostics')
      return { connected: true, activeContexts: 0 }
    },
    touchHeartbeat: async () => {
      calls.push('heartbeat:touch')
    },
    clearHeartbeat: async () => {
      calls.push('heartbeat:clear')
    },
    startWorker: () => {
      calls.push('worker:start')
      return { close: closeWorker }
    },
    startScheduler: () => calls.push('scheduler:start'),
    closeBrowser: async () => {
      calls.push('browser:close')
    },
    logger: {
      info: () => {},
      error: () => {},
    },
  }
}

describe('standalone worker runtime', () => {
  it('warms Chromium and publishes readiness before consuming jobs', async () => {
    const deps = dependencies()
    const runtime = createWorkerRuntime(deps)

    await runtime.start()

    expect(deps.calls).toEqual([
      'env',
      'browser:warm',
      'browser:diagnostics',
      'heartbeat:touch',
      'worker:start',
      'scheduler:start',
    ])
  })

  it('clears liveness and closes browser work before the queue worker', async () => {
    const deps = dependencies()
    const runtime = createWorkerRuntime(deps)
    await runtime.start()

    await runtime.shutdown(0)

    expect(deps.calls.slice(-4)).toEqual([
      'heartbeat:clear',
      'browser:close',
      'worker:close',
      'exit:0',
    ])
  })

  it('makes repeated shutdown signals idempotent', async () => {
    const deps = dependencies()
    const runtime = createWorkerRuntime(deps)
    await runtime.start()

    await Promise.all([runtime.shutdown(1), runtime.shutdown(1)])

    expect(deps.closeWorker).toHaveBeenCalledOnce()
    expect(deps.exit).toHaveBeenCalledOnce()
  })
})
