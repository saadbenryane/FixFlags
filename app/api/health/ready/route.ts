import { NextResponse } from 'next/server'
import { readLaunchReadiness } from '@/lib/health/readiness'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const readiness = await readLaunchReadiness()
    return NextResponse.json(readiness, { status: readiness.ok ? 200 : 503 })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 503 }
    )
  }
}
