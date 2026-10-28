import { randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { hashApiKey } from '@/lib/security/api-keys'
import { exchangeAuthorizationCode, exchangeRefreshToken, issueAuthorizationCode, mcpResource, pkceChallenge } from '../oauth'
import { validateApiKey } from '../tools'
import { NextRequest } from 'next/server'
import { POST as tokenPost } from '@/app/api/oauth/token/route'
import { POST as mcpPost } from '@/app/api/mcp/route'
import { getAppUrl } from '@/lib/get-app-url'
import { MCP_PROTOCOL_VERSION, MCP_TOOLS } from '../tool-manifest'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip

run('MCP OAuth issuance through the database', () => {
  const users: string[] = []
  const verifier = 'v'.repeat(50), clientId = 'fixture-client', redirectUri = 'https://client.example/callback'
  const scopes = ['sites:read', 'flags:write']
  beforeAll(() => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    await prisma.user.deleteMany({ where: { id: { in: users.splice(0) } } })
  })
  afterAll(async () => { await prisma.$disconnect() })

  async function fixture(kind: 'code' | 'refresh') {
    const user = await prisma.user.create({ data: { email: randomUUID() + '@oauth.test' } })
    users.push(user.id)
    const raw = kind === 'code' ? await issueAuthorizationCode({ userId: user.id, clientId, redirectUri,
      codeChallenge: pkceChallenge(verifier), resource: mcpResource(), scopes }) : randomUUID()
    if (kind === 'refresh') await prisma.oAuthRefreshToken.create({ data: { tokenHash: hashApiKey(raw), userId: user.id,
      audience: mcpResource(), scopes, expiresAt: new Date(Date.now() + 3600_000) } })
    const exchange = () => kind === 'code' ? exchangeAuthorizationCode({ code: raw, clientId, redirectUri,
      codeVerifier: verifier, resource: mcpResource() }) : exchangeRefreshToken({ refreshToken: raw, resource: mcpResource() })
    const original = () => kind === 'code' ? prisma.oAuthAuthorizationCode.findUniqueOrThrow({ where: { codeHash: hashApiKey(raw) } })
      : prisma.oAuthRefreshToken.findUniqueOrThrow({ where: { tokenHash: hashApiKey(raw) } })
    return { user, raw, exchange, original }
  }

  function interruptIssuance(model: 'apiKey' | 'oAuthRefreshToken') {
    const transaction = prisma.$transaction.bind(prisma) as (operation: (tx: Prisma.TransactionClient) => Promise<unknown>) => Promise<unknown>
    // Keep real SQL and rollback. Interrupt only the selected credential write.
    return vi.spyOn(prisma, '$transaction').mockImplementation(((operation: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
      transaction(tx => operation(new Proxy(tx, { get(target, key) {
        const value = Reflect.get(target, key)
        return key !== model ? value : new Proxy(value, { get(delegate, method) {
          return method === 'create' ? async () => { throw new Error('Controlled credential write failure') } : Reflect.get(delegate, method)
        } })
      } })))) as typeof prisma.$transaction)
  }

  it.each((['code', 'refresh'] as const).flatMap(kind => (['apiKey', 'oAuthRefreshToken'] as const).map(model => ({ kind, model }))))(
    'retains the $kind grant when replacement $model creation fails, then permits one retry', async ({ kind, model }) => {
      const { user, exchange, original } = await fixture(kind)
      const interruption = interruptIssuance(model)
      try { await expect(exchange()).rejects.toThrow('Controlled credential write failure') }
      finally { interruption.mockRestore() }
      const retained = await original()
      expect('consumedAt' in retained ? retained.consumedAt : retained.revokedAt).toBeNull()
      expect(await prisma.apiKey.count({ where: { userId: user.id } })).toBe(0)
      expect(await prisma.oAuthRefreshToken.count({ where: { userId: user.id } })).toBe(kind === 'refresh' ? 1 : 0)
      const pair = await exchange()
      expect(pair).toMatchObject({ token_type: 'Bearer', scope: scopes.join(' ') })
      expect(await validateApiKey(pair!.access_token)).toMatchObject({ user: { id: user.id }, apiKey: { scopes, audience: mcpResource() } })
      expect(await prisma.oAuthRefreshToken.findUnique({ where: { tokenHash: hashApiKey(pair!.refresh_token) } }))
        .toMatchObject({ userId: user.id, revokedAt: null, scopes })
      expect(await exchange()).toBeNull()
      expect(await prisma.apiKey.count({ where: { userId: user.id } })).toBe(1)
    })

  it.each(['code', 'refresh'] as const)('issues one pair for concurrent exchanges of a %s grant', async kind => {
    const { user, exchange } = await fixture(kind)
    const results = await Promise.all([exchange(), exchange()])
    expect(results.filter(Boolean)).toHaveLength(1)
    expect(await prisma.apiKey.count({ where: { userId: user.id } })).toBe(1)
    expect(await prisma.oAuthRefreshToken.count({ where: { userId: user.id, revokedAt: null } })).toBe(1)
  })

  it.each(['code', 'refresh'] as const)('cannot spend a %s grant while its owner is unavailable', async kind => {
    const { user, exchange, original } = await fixture(kind)
    await prisma.user.update({ where: { id: user.id }, data: { lifecycleStatus: 'SUSPENDED' } })
    expect(await exchange()).toBeNull()
    const retained = await original()
    expect('consumedAt' in retained ? retained.consumedAt : retained.revokedAt).toBeNull()
    expect(await prisma.apiKey.count({ where: { userId: user.id } })).toBe(0)
    await prisma.user.update({ where: { id: user.id }, data: { lifecycleStatus: 'ACTIVE' } })
    expect(await exchange()).not.toBeNull()
  })

  it('retains authorization-code binding to the approved client, redirect, resource and PKCE verifier', async () => {
    const { raw, exchange, original } = await fixture('code')
    const valid = { code: raw, clientId, redirectUri, codeVerifier: verifier, resource: mcpResource() }
    for (const changed of [{ clientId: 'other-client' }, { redirectUri: 'https://other.example/callback' },
      { codeVerifier: 'x'.repeat(50) }, { resource: 'https://other.example/api/mcp' }])
      expect(await exchangeAuthorizationCode({ ...valid, ...changed })).toBeNull()
    expect(await original()).toMatchObject({ consumedAt: null })
    expect(await exchange()).not.toBeNull()
  })

  it.each(['code', 'refresh'] as const)('cannot issue from an expired %s grant', async kind => {
    const { raw, user, exchange } = await fixture(kind)
    if (kind === 'code') await prisma.oAuthAuthorizationCode.update({ where: { codeHash: hashApiKey(raw) }, data: { expiresAt: new Date(0) } })
    else await prisma.oAuthRefreshToken.update({ where: { tokenHash: hashApiKey(raw) }, data: { expiresAt: new Date(0) } })
    expect(await exchange()).toBeNull()
    expect(await prisma.apiKey.count({ where: { userId: user.id } })).toBe(0)
  })

  it('exchanges and rotates credentials through the token handler, then enforces their scope in the installed MCP handler', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', new URL(mcpResource()).origin)
    const { raw } = await fixture('code')
    const tokenRequest = (data: Record<string, string>) => tokenPost(new NextRequest(getAppUrl() + '/api/oauth/token', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(data),
    }))
    const request = { grant_type: 'authorization_code', code: raw, client_id: clientId, redirect_uri: redirectUri,
      code_verifier: verifier, resource: mcpResource() }
    const response = await tokenRequest(request)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    const pair = await response.json() as { access_token: string; refresh_token: string; scope: string }
    expect(pair.scope).toBe(scopes.join(' '))
    expect((await tokenRequest(request)).status).toBe(400)
    const refreshed = await tokenRequest({ grant_type: 'refresh_token', refresh_token: pair.refresh_token, resource: mcpResource() })
    expect(refreshed.status).toBe(200)
    const current = await refreshed.json() as typeof pair
    expect((await tokenRequest({ grant_type: 'refresh_token', refresh_token: pair.refresh_token, resource: mcpResource() })).status).toBe(400)
    const call = (tool: string, args: Record<string, unknown>) => mcpPost(new NextRequest(getAppUrl() + '/api/mcp', {
      method: 'POST', headers: { authorization: 'Bearer ' + current.access_token, host: new URL(getAppUrl()).host,
        'content-type': 'application/json', accept: 'application/json', 'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
        'Mcp-Method': 'tools/call', 'Mcp-Name': tool },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: tool, arguments: args, _meta: {
        'io.modelcontextprotocol/protocolVersion': MCP_PROTOCOL_VERSION,
        'io.modelcontextprotocol/clientInfo': { name: 'local-oauth-proof', version: '1.0.0' },
        'io.modelcontextprotocol/clientCapabilities': {},
      } } }),
    }))
    const read = await call(MCP_TOOLS.listSites.name, {})
    expect(read.status).toBe(200)
    expect(await read.json()).toMatchObject({ result: { structuredContent: { sites: [] } } })
    const write = await call(MCP_TOOLS.run.name, { siteId: 'unadmitted-site', scope: 'site', idempotencyKey: 'must-not-run' })
    expect(write.status).toBe(403)
    expect(await write.json()).toMatchObject({ error: { data: { code: 'INSUFFICIENT_SCOPE', scope: 'runs:write' } } })
  })
})
