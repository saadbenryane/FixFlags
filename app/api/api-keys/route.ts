import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { generateApiKey, MAX_ACTIVE_API_KEYS } from '@/lib/security/api-keys'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { enforceRateLimit, requestClientId } from '@/lib/security/rate-limit'
import { isApiKeyClient } from '@/lib/mcp/builders'
import { developerKeyExpiresAt, developerKeyExpiryDays, developerKeyPreset } from '@/lib/mcp/developer-key-policy'

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return apiError('Unauthorized', 401, { code: 'UNAUTHORIZED' })

    const keys = await prisma.apiKey.findMany({
      where: {
        userId: session.user.id,
        revokedAt: null,
        audience: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: {
        id: true,
        name: true,
        prefix: true,
        lastFour: true,
        client: true,
        scopes: true,
        expiresAt: true,
        lastUsed: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(keys)
  } catch (err) {
    return handleRouteError(err, 'Failed to list API keys')
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return apiError('Unauthorized', 401, { code: 'UNAUTHORIZED' })

    const clientId = requestClientId(await headers())
    await enforceRateLimit({
      scope: 'api-keys',
      identifier: `${session.user.id}:${clientId}`,
      limit: 10,
      windowSeconds: 60,
    })

    const body = await req.json().catch(() => ({}))
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : 'Default'
    if (body.client != null && !isApiKeyClient(body.client)) {
      return apiError('Unsupported API key client', 400, {
        code: 'INVALID_API_KEY_CLIENT',
        action: 'choose_supported_client',
      })
    }
    const client = body.client ?? null
    const preset = developerKeyPreset(body.scopePreset)
    if (!preset) {
      return apiError('Choose a supported access level', 400, {
        code: 'INVALID_API_KEY_SCOPE',
        action: 'choose_supported_scope',
      })
    }
    const expiresInDays = developerKeyExpiryDays(body.expiresInDays)
    if (!expiresInDays) {
      return apiError('Choose a supported expiration period', 400, {
        code: 'INVALID_API_KEY_EXPIRY',
        action: 'choose_supported_expiry',
      })
    }

    const activeCount = await prisma.apiKey.count({
      where: {
        userId: session.user.id,
        revokedAt: null,
        audience: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    })
    if (activeCount >= MAX_ACTIVE_API_KEYS) {
      return apiError(`You can have up to ${MAX_ACTIVE_API_KEYS} active API keys`, 409, {
        code: 'API_KEY_LIMIT',
        action: 'revoke_key',
      })
    }

    const generated = generateApiKey()
    const apiKey = await prisma.apiKey.create({
      data: {
        userId: session.user.id,
        name: name || 'Default',
        client,
        keyHash: generated.keyHash,
        prefix: generated.prefix,
        lastFour: generated.lastFour,
        scopes: [...preset.scopes],
        expiresAt: developerKeyExpiresAt(expiresInDays),
      },
    })

    return NextResponse.json(
      {
        id: apiKey.id,
        name: apiKey.name,
        key: generated.rawKey,
        prefix: apiKey.prefix,
        lastFour: apiKey.lastFour,
        client: apiKey.client,
        scopes: apiKey.scopes,
        expiresAt: apiKey.expiresAt,
      },
      { status: 201 }
    )
  } catch (err) {
    return handleRouteError(err, 'Failed to create API key')
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user)
      return apiError('Sign in to access this resource', 401, {
        code: 'UNAUTHORIZED',
      })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return apiError('Missing API key id', 400, { code: 'INVALID_REQUEST' })

    await prisma.apiKey.updateMany({
      where: { id, userId: session.user.id },
      data: { revokedAt: new Date() },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleRouteError(err, 'Failed to revoke API key')
  }
}
