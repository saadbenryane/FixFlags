import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canUseApiKeys } from '@/lib/auth/permissions'
import {
  decideCliDeviceAuthorization,
  getCliAuthorizationForUserCode,
} from '@/lib/cli/device-auth'
import { apiError, handleRouteError } from '@/lib/api/errors'
import {
  enforceRateLimit,
  requestClientId,
} from '@/lib/security/rate-limit'

async function viewer() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  return user ? { session, user } : null
}

export async function GET(req: NextRequest) {
  try {
    const current = await viewer()
    if (!current) {
      return apiError('Sign in to authorize the CLI', 401, {
        code: 'UNAUTHORIZED',
      })
    }
    const userCode = new URL(req.url).searchParams.get('user_code') ?? ''
    const authorization = await getCliAuthorizationForUserCode(userCode)
    if (!authorization) {
      return apiError('Authorization code not found', 404, {
        code: 'INVALID_DEVICE_CODE',
      })
    }
    return NextResponse.json({
      status: authorization.status,
      expiresAt: authorization.expiresAt,
      canAuthorize: canUseApiKeys(current.user),
    })
  } catch (error) {
    return handleRouteError(error, 'Could not read CLI authorization')
  }
}

export async function POST(req: NextRequest) {
  try {
    const current = await viewer()
    if (!current) {
      return apiError('Sign in to authorize the CLI', 401, {
        code: 'UNAUTHORIZED',
      })
    }
    if (!canUseApiKeys(current.user)) {
      return apiError('CLI access requires the Pro plan or higher', 402, {
        code: 'UPGRADE_REQUIRED',
        action: 'upgrade',
      })
    }
    await enforceRateLimit({
      scope: 'cli-authorize',
      identifier: `${current.user.id}:${requestClientId(await headers())}`,
      limit: 20,
      windowSeconds: 60,
    })
    const body = (await req.json().catch(() => null)) as {
      userCode?: unknown
      decision?: unknown
    } | null
    if (
      typeof body?.userCode !== 'string' ||
      (body.decision !== 'approve' && body.decision !== 'deny')
    ) {
      return apiError('A valid code and decision are required', 400, {
        code: 'INVALID_REQUEST',
      })
    }
    const result = await decideCliDeviceAuthorization({
      userCode: body.userCode,
      userId: current.user.id,
      approve: body.decision === 'approve',
    })
    if (!result.ok) {
      return apiError('This authorization request cannot be used', 409, {
        code: result.code,
      })
    }
    return NextResponse.json({ status: result.status })
  } catch (error) {
    return handleRouteError(error, 'Could not authorize the CLI')
  }
}
