import { NextResponse } from 'next/server'
import { getAuditBrowser, getChromePath } from '@/lib/audit/screenshot'
import { checkR2Connection, isR2Configured } from '@/lib/storage/r2'

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
      executablePath: getChromePath() ?? null,
      error: null as string | null,
    },
    storage: {
      ok: false,
      configured: isR2Configured(),
      error: null as string | null,
    },
  }

  // Browser: launch (shared pool) + trivial screenshot.
  try {
    const browser = await getAuditBrowser()
    const page = await browser.newPage()
    try {
      await page.setContent('<!doctype html><html><body>ok</body></html>')
      await page.screenshot({ type: 'png' })
      result.browser.ok = true
    } finally {
      await page.close().catch(() => {})
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
