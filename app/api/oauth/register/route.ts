import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isAllowedRedirect } from '@/lib/mcp/oauth'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { redirect_uris?: unknown; client_name?: unknown } | null
  const redirectUris = Array.isArray(body?.redirect_uris) ? body.redirect_uris.filter((item): item is string => typeof item === 'string') : []
  if (redirectUris.length === 0 || redirectUris.some((uri) => !isAllowedRedirect(uri))) {
    return NextResponse.json({ error: 'invalid_client_metadata' }, { status: 400 })
  }
  const id = `ff_client_${randomBytes(16).toString('hex')}`
  const name = typeof body?.client_name === 'string' ? body.client_name.slice(0, 80) : null
  await prisma.oAuthClient.create({ data: { id, name, redirectUris } })
  return NextResponse.json({
    client_id: id,
    client_name: name,
    redirect_uris: redirectUris,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  }, { status: 201 })
}
