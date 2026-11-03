import { NextResponse } from 'next/server'
import { readWorkerOperationalHealth } from '@/lib/health/operational'

export const dynamic = 'force-dynamic'

/** Continuous HTTP monitors receive a failing status for lost obligations,
 * including when the web process and worker heartbeat are still alive. */
export async function GET() {
  const headers = { 'Cache-Control': 'private, no-store' }
  try {
    const health = await readWorkerOperationalHealth()
    return NextResponse.json({ ok: health.ok, status: health.status }, { status: health.ok ? 200 : 503, headers })
  } catch {
    return NextResponse.json({ ok: false, status: 'operational_health_unavailable' }, { status: 503, headers })
  }
}
