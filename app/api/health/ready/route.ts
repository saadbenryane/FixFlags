import { NextResponse } from 'next/server'
import { readLaunchReadiness } from '@/lib/health/readiness'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const selected = new URL(request.url).searchParams.get('profile')
    const profile = selected === 'commercial' ? 'commercial' : 'free-launch'
    const readiness = await readLaunchReadiness(undefined, profile)
    return NextResponse.json(readiness, { status: readiness.ok ? 200 : 503 })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 503 }
    )
  }
}
