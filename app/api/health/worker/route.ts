import { NextResponse } from 'next/server'
import { readWorkerOperationalHealth } from '@/lib/health/operational'

export const dynamic = 'force-dynamic'

/** Compatibility diagnostic: inspect body.ok; failures retain HTTP 200. */
export async function GET() {
  return NextResponse.json(await readWorkerOperationalHealth(), {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
