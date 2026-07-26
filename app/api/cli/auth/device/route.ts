import { NextRequest, NextResponse } from 'next/server'
import { createCliDeviceAuthorization } from '@/lib/cli/device-auth'
import { apiError, handleRouteError } from '@/lib/api/errors'
import {
  enforceRateLimit,
  requestClientId,
} from '@/lib/security/rate-limit'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    await enforceRateLimit({
      scope: 'cli-device',
      identifier: requestClientId(req.headers),
      limit: 10,
      windowSeconds: 60,
    })
    return NextResponse.json(
      await createCliDeviceAuthorization(new URL(req.url).origin),
      { status: 201, headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    if (error instanceof TypeError) {
      return apiError('Invalid device authorization request', 400, {
        code: 'INVALID_REQUEST',
      })
    }
    return handleRouteError(error, 'Could not start CLI authorization')
  }
}
