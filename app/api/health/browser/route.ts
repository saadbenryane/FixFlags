import { NextResponse } from 'next/server'
import { checkR2Connection, isR2Configured } from '@/lib/storage/r2'
import { readWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'

export const dynamic = 'force-dynamic'

/**
 * Scanning readiness probe. Verifies the two subsystems that, when broken, make
 * every scan fail with the generic "site unreachable" error:
 *   - Chromium can actually launch and take a screenshot.
 *   - Screenshot storage (R2 in prod) is reachable.
 *
 * Always returns HTTP 200 with a per-subsystem snapshot so it never gates a
 * deploy, while making a broken scanner answerable with a single curl:
 *   curl https://<host>/api/health/browser
 */
export async function GET() {
  const result = {
    ok: false,
    browser: {
      ok: false,
      workerCount: 0,
      activeContexts: 0,
      error: null as string | null,
    },
    storage: {
      ok: false,
      configured: isR2Configured(),
      error: null as string | null,
    },
  }

  // Chromium belongs to dedicated worker processes. The web health route reads
  // their confirmed browser state instead of launching another browser here.
  try {
    const heartbeat = await readWorkerHeartbeat()
    result.browser.ok = heartbeat.alive && heartbeat.browserOk
    result.browser.workerCount = heartbeat.workerCount
    result.browser.activeContexts = heartbeat.activeBrowserContexts
    if (!result.browser.ok) {
      result.browser.error = 'No live worker has confirmed Chromium readiness'
    }
  } catch (err) {
    result.browser.error = err instanceof Error ? err.message : String(err)
  }

  // Storage: verify connectivity in production; local disk is always available
  // in dev, so there is nothing to probe there.
  try {
    if (process.env.NODE_ENV === 'production') {
      await checkR2Connection()
    }
    result.storage.ok = true
  } catch (err) {
    result.storage.error = err instanceof Error ? err.message : String(err)
  }

  result.ok = result.browser.ok && result.storage.ok
  return NextResponse.json(result)
}
