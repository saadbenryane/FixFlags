import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { createCliDeviceAuthorization, decideCliDeviceAuthorization, exchangeCliDeviceCode, hashCliDeviceCode } from '../device-auth'
import { validateApiKey } from '@/lib/mcp/tools'
import { generateApiKey, MAX_ACTIVE_API_KEYS } from '@/lib/security/api-keys'
import { NextRequest } from 'next/server'
import { POST as tokenHandler } from '@/app/api/cli/auth/token/route'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('CLI credential lifetime through the database', () => {
  const users: string[] = [], deviceHashes: string[] = []
  beforeAll(() => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
  })
  afterEach(async () => {
    vi.useRealTimers()
    await prisma.cliDeviceAuthorization.deleteMany({ where: { deviceCodeHash: { in: deviceHashes.splice(0) } } })
    await prisma.user.deleteMany({ where: { id: { in: users.splice(0) } } })
  })
  afterAll(async () => { await prisma.$disconnect() })
  async function owner() {
    const user = await prisma.user.create({ data: { email: randomUUID() + '@cli.test' } })
    users.push(user.id); return user
  }
  async function device() {
    const request = await createCliDeviceAuthorization('https://fixflags.test')
    deviceHashes.push(hashCliDeviceCode(request.deviceCode)); return request
  }
  async function approved(userId: string, collect: boolean) {
    const request = await device()
    expect(await decideCliDeviceAuthorization({ userId, userCode: request.userCode, approve: true })).toMatchObject({ ok: true })
    const row = await prisma.cliDeviceAuthorization.findUniqueOrThrow({ where: { deviceCodeHash: hashCliDeviceCode(request.deviceCode) } })
    const credential = collect ? await exchangeCliDeviceCode(request.deviceCode) : null
    return { request, row, credential }
  }
  function afterExpiry(expiresAt: Date) { vi.useFakeTimers({ toFake: ['Date'], now: expiresAt.getTime() + 1 }) }

  it('does not revoke a collected credential when its old device code is polled after expiry', async () => {
    const user = await owner(), issued = await approved(user.id, true)
    expect(issued.credential?.ok).toBe(true)
    afterExpiry(issued.row.expiresAt)
    await exchangeCliDeviceCode(issued.request.deviceCode)
    expect(await prisma.apiKey.findUniqueOrThrow({ where: { id: issued.row.apiKeyId! } })).toMatchObject({ revokedAt: null })
    if (!issued.credential?.ok) throw new Error('Fixture did not collect its key')
    expect(await validateApiKey(issued.credential.accessToken)).not.toBeNull()
  })
  it('keeps collected credentials active when another client starts while revoking expired uncollected keys', async () => {
    const user = await owner(), collected = await approved(user.id, true), uncollected = await approved(user.id, false)
    afterExpiry(uncollected.row.expiresAt)
    await device()
    expect(await prisma.apiKey.findUniqueOrThrow({ where: { id: collected.row.apiKeyId! } })).toMatchObject({ revokedAt: null })
    expect(await prisma.apiKey.findUniqueOrThrow({ where: { id: uncollected.row.apiKeyId! } })).toMatchObject({ revokedAt: expect.any(Date) })
    if (!collected.credential?.ok) throw new Error('Fixture did not collect its key')
    expect(await validateApiKey(collected.credential.accessToken)).not.toBeNull()
  })
  it.each([true, false])('admits one terminal decision when competing with approval: %s', async secondApproval => {
    const first = await owner(), second = await owner(), request = await device()
    const decisions = await Promise.all([
      decideCliDeviceAuthorization({ userId: first.id, userCode: request.userCode, approve: true }),
      decideCliDeviceAuthorization({ userId: second.id, userCode: request.userCode, approve: secondApproval }),
    ])
    expect(decisions.filter(result => result.ok)).toHaveLength(1)
    const row = await prisma.cliDeviceAuthorization.findUniqueOrThrow({ where: { deviceCodeHash: hashCliDeviceCode(request.deviceCode) } })
    expect(await prisma.apiKey.count({ where: { userId: { in: [first.id, second.id] } } })).toBe(row.status === 'APPROVED' ? 1 : 0)
  })
  it('cannot issue a credential for an inactive owner', async () => {
    const user = await owner(), request = await device()
    await prisma.user.update({ where: { id: user.id }, data: { lifecycleStatus: 'SUSPENDED' } })
    await expect(decideCliDeviceAuthorization({ userId: user.id, userCode: request.userCode, approve: true }))
      .rejects.toMatchObject({ code: 'ACCOUNT_UNAVAILABLE' })
    expect(await prisma.apiKey.count({ where: { userId: user.id } })).toBe(0)
  })
  it('retains the one-use credential when decryption fails, then collects it once through the token handler', async () => {
    const user = await owner(), issued = await approved(user.id, false)
    await prisma.cliDeviceAuthorization.update({ where: { id: issued.row.id }, data: { encryptedCredential: 'unreadable' } })
    await expect(exchangeCliDeviceCode(issued.request.deviceCode)).rejects.toThrow()
    expect(await prisma.cliDeviceAuthorization.findUniqueOrThrow({ where: { id: issued.row.id } }))
      .toMatchObject({ status: 'APPROVED', consumedAt: null })
    await prisma.cliDeviceAuthorization.update({ where: { id: issued.row.id },
      data: { encryptedCredential: issued.row.encryptedCredential, lastPolledAt: null } })
    const poll = () => tokenHandler(new NextRequest('https://fixflags.test/api/cli/auth/token', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ deviceCode: issued.request.deviceCode }),
    }))
    const response = await poll()
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    const credential = await response.json()
    expect(await validateApiKey(credential.accessToken)).not.toBeNull()
    expect((await poll()).status).toBe(409)
  })
  it('preserves the developer-key limit across concurrent device approvals', async () => {
    const user = await owner(), first = await device(), second = await device()
    await prisma.apiKey.createMany({ data: Array.from({ length: MAX_ACTIVE_API_KEYS - 1 }, () => {
      const key = generateApiKey()
      return { userId: user.id, name: 'Existing fixture credential', keyHash: key.keyHash, prefix: key.prefix, lastFour: key.lastFour }
    }) })
    const decisions = await Promise.all([first, second].map(request => decideCliDeviceAuthorization({ userId: user.id,
      userCode: request.userCode, approve: true })))
    expect(decisions.filter(result => result.ok)).toHaveLength(1)
    expect(await prisma.apiKey.count({ where: { userId: user.id, revokedAt: null } })).toBe(MAX_ACTIVE_API_KEYS)
  })
})
