import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isProdStorageConfigured } from '@/lib/env'

export const dynamic = 'force-dynamic'

/**
 * Liveness + readiness probe (the platform healthcheck path).
 *
 * Returns 200 whenever the database is reachable so a deploy is never frozen by
 * a degradable misconfiguration. Storage readiness is reported as an
 * informational flag (`storageConfigured`) rather than gating the healthcheck.
 * Without it scans fail with a clear message, but the service is still up and
 * the rest of the product works. /api/health/browser does the deeper
 * launch-Chromium + connect-to-R2 probe.
 */
export async function GET() {
  const storageConfigured =
    process.env.NODE_ENV === 'production' ? isProdStorageConfigured() : true

  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({
      status: 'ok',
      database: 'ok',
      storageConfigured,
      ...(storageConfigured ? {} : { degraded: ['storage'] }),
    })
  } catch {
    return NextResponse.json(
      { status: 'error', database: 'error', storageConfigured },
      { status: 503 }
    )
  }
}
