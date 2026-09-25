import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  audienceMatches,
  isAllowedRedirect,
  issueAuthorizationCode,
  mcpIssuer,
  mcpResource,
  normalizeScopes,
  redirectAllowedForClient,
} from '@/lib/mcp/oauth'

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char
  ))
}

function readParams(req: NextRequest): URLSearchParams {
  return req.nextUrl.searchParams
}

function deny(redirectUri: string, state: string | null, error: string) {
  if (!isAllowedRedirect(redirectUri)) {
    return NextResponse.json({ error }, { status: 400 })
  }
  const target = new URL(redirectUri)
  target.searchParams.set('error', error)
  target.searchParams.set('iss', mcpIssuer())
  if (state) target.searchParams.set('state', state)
  return NextResponse.redirect(target)
}

async function authorize(req: NextRequest, approved: boolean) {
  const params = readParams(req)
  const clientId = params.get('client_id')?.trim() ?? ''
  const redirectUri = params.get('redirect_uri')?.trim() ?? ''
  const state = params.get('state')
  const resource = params.get('resource')?.trim() ?? ''
  const challenge = params.get('code_challenge')?.trim() ?? ''
  const method = params.get('code_challenge_method')?.trim() ?? ''
  if (params.get('response_type') !== 'code' || !clientId || !redirectUri || !state || state.length < 8) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }
  if (method !== 'S256' || challenge.length < 43) return deny(redirectUri, state, 'invalid_request')
  if (!audienceMatches(resource, mcpResource())) return deny(redirectUri, state, 'invalid_target')
  if (!(await redirectAllowedForClient(clientId, redirectUri))) {
    return NextResponse.json({ error: 'invalid_client' }, { status: 400 })
  }
  const session = await auth.api.getSession({ headers: req.headers }).catch(() => null)
  if (!session?.user) {
    const next = new URL('/sign-in', req.url)
    next.searchParams.set('next', `${req.nextUrl.pathname}${req.nextUrl.search}`)
    return NextResponse.redirect(next)
  }
  if (!approved) {
    const fields = ['client_id', 'redirect_uri', 'state', 'resource', 'code_challenge', 'code_challenge_method', 'response_type', 'scope']
      .map((name) => {
        const value = params.get(name)
        return value == null ? '' : `<input type="hidden" name="${name}" value="${escapeHtml(value)}" />`
      })
      .join('')
    const action = escapeHtml(`${req.nextUrl.pathname}${req.nextUrl.search}`)
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Allow FixFlags access</title></head><body style="font-family: sans-serif; margin: 2rem auto; max-width: 32rem; line-height: 1.5"><h1>Allow this coding agent?</h1><p>It can read your Sites and request independent verification. It cannot mark an Outcome clear.</p><form method="post" action="${action}">${fields}<button type="submit" name="approve" value="yes" style="min-height: 44px; min-width: 44px">Allow</button> <button type="submit" name="approve" value="no" style="min-height: 44px; min-width: 44px">Deny</button></form></body></html>`
    return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
  }
  const decision = (await req.formData()).get('approve')
  if (decision !== 'yes') return deny(redirectUri, state, 'access_denied')
  const code = await issueAuthorizationCode({
    userId: session.user.id,
    clientId,
    redirectUri,
    codeChallenge: challenge,
    resource: mcpResource(),
    scopes: normalizeScopes(params.get('scope')),
  })
  const target = new URL(redirectUri)
  target.searchParams.set('code', code)
  target.searchParams.set('state', state)
  target.searchParams.set('iss', mcpIssuer())
  return NextResponse.redirect(target)
}

export function GET(req: NextRequest) {
  return authorize(req, false)
}

export async function POST(req: NextRequest) {
  return authorize(req, true)
}
