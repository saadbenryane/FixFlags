import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/mcp/tools'
import { extractMcpCredential } from '@/lib/mcp/auth'
import { prisma } from '@/lib/db'
import { apiError, handleRouteError } from '@/lib/api/errors'

async function authenticate(req: NextRequest) {
  const credential = extractMcpCredential(req.headers)
  if (!credential.ok) return null
  return validateApiKey(credential.key)
}

export async function GET(req: NextRequest) {
  try {
    const context = await authenticate(req)
    if (!context) {
      return apiError('Provide a valid CLI credential', 401, {
        code: 'INVALID_API_KEY',
      })
    }
    return NextResponse.json({
      user: {
        id: context.user.id,
        email: context.user.email,
        name: context.user.name,
        plan: context.user.plan,
      },
      credential: {
        id: context.apiKey.id,
        client: context.apiKey.client,
      },
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return handleRouteError(error, 'Could not read CLI identity')
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const context = await authenticate(req)
    if (!context) {
      return apiError('Provide a valid CLI credential', 401, {
        code: 'INVALID_API_KEY',
      })
    }
    await prisma.apiKey.update({
      where: { id: context.apiKey.id },
      data: { revokedAt: new Date() },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleRouteError(error, 'Could not revoke CLI credential')
  }
}
