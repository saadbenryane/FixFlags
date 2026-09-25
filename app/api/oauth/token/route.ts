import { NextRequest, NextResponse } from 'next/server'
import { exchangeAuthorizationCode, exchangeRefreshToken, mcpResource } from '@/lib/mcp/oauth'

export async function POST(req: NextRequest) {
  const body = await req.formData().catch(() => null)
  if (!body) return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  const grant = String(body.get('grant_type') ?? '')
  const resource = String(body.get('resource') ?? mcpResource())
  const tokens = grant === 'authorization_code'
    ? await exchangeAuthorizationCode({
        code: String(body.get('code') ?? ''),
        redirectUri: String(body.get('redirect_uri') ?? ''),
        clientId: String(body.get('client_id') ?? ''),
        codeVerifier: String(body.get('code_verifier') ?? ''),
        resource,
      })
    : grant === 'refresh_token'
      ? await exchangeRefreshToken({ refreshToken: String(body.get('refresh_token') ?? ''), resource })
      : null
  if (!tokens) return NextResponse.json({ error: 'invalid_grant' }, { status: 400 })
  return NextResponse.json(tokens, { headers: { 'Cache-Control': 'no-store' } })
}
