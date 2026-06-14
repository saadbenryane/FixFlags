import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { canUseApiKeys } from '@/lib/auth/permissions'
import {
  generateApiKey,
  MAX_ACTIVE_API_KEYS,
} from '@/lib/security/api-keys'
import { apiError, handleRouteError } from '@/lib/api/errors'

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return apiError('Unauthorized', 401, { code: 'UNAUTHORIZED' })

  const keys = await prisma.apiKey.findMany({
    where: { userId: session.user.id, revokedAt: null },
    select: {
      id: true,
      name: true,
      prefix: true,
      lastFour: true,
      lastUsed: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(keys)
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return apiError('Unauthorized', 401, { code: 'UNAUTHORIZED' })

    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user || !canUseApiKeys(user)) {
      return apiError('API keys require the Pro plan or higher', 402, {
        code: 'UPGRADE_REQUIRED',
        action: 'upgrade',
      })
    }

    const body = await req.json().catch(() => ({}))
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : 'Default'

    const activeCount = await prisma.apiKey.count({
      where: { userId: session.user.id, revokedAt: null },
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
        keyHash: generated.keyHash,
        prefix: generated.prefix,
        lastFour: generated.lastFour,
      },
    })

    return NextResponse.json(
      {
        id: apiKey.id,
        name: apiKey.name,
        key: generated.rawKey,
        prefix: apiKey.prefix,
        lastFour: apiKey.lastFour,
      },
      { status: 201 }
    )
  } catch (err) {
    return handleRouteError(err, 'Failed to create API key')
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return apiError('Unauthorized', 401, { code: 'UNAUTHORIZED' })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return apiError('Missing API key id', 400, { code: 'INVALID_REQUEST' })

  await prisma.apiKey.updateMany({
    where: { id, userId: session.user.id },
    data: { revokedAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
