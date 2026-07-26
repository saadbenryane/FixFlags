import { NextRequest, NextResponse } from 'next/server'
import { exchangeCliDeviceCode } from '@/lib/cli/device-auth'
import { apiError, handleRouteError } from '@/lib/api/errors'
import {
  enforceRateLimit,
  requestClientId,
} from '@/lib/security/rate-limit'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    await enforceRateLimit({
      scope: 'cli-token',
      identifier: requestClientId(req.headers),
      limit: 60,
      windowSeconds: 60,
    })
    const body = (await req.json().catch(() => null)) as {
      deviceCode?: unknown
    } | null
    if (typeof body?.deviceCode !== 'string' || !body.deviceCode) {
      return apiError('deviceCode is required', 400, {
        code: 'INVALID_REQUEST',
      })
    }

    const result = await exchangeCliDeviceCode(body.deviceCode)
    if (result.ok) {
      return NextResponse.json({
        accessToken: result.accessToken,
        tokenType: result.tokenType,
      }, { headers: { 'Cache-Control': 'no-store' } })
    }

    const statuses: Record<string, number> = {
      AUTHORIZATION_PENDING: 428,
      SLOW_DOWN: 429,
      ACCESS_DENIED: 403,
      EXPIRED_DEVICE_CODE: 410,
      DEVICE_CODE_ALREADY_USED: 409,
      INVALID_DEVICE_CODE: 400,
    }
    const response = apiError('CLI authorization is not available', statuses[result.code] ?? 400, {
      code: result.code,
    })
    if (result.code === 'SLOW_DOWN') {
      response.headers.set('Retry-After', String(result.retryAfter))
    }
    return response
  } catch (error) {
    return handleRouteError(error, 'Could not complete CLI authorization')
  }
}
