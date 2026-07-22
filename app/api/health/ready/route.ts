import { NextResponse } from 'next/server'
import { readLaunchReadiness } from '@/lib/health/readiness'

export const dynamic = 'force-dynamic'

export async function GET() {
  const readiness = await readLaunchReadiness()
  return NextResponse.json(readiness, { status: readiness.ok ? 200 : 503 })
}
