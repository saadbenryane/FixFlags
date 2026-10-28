import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '@/lib/db'
import { encryptSecret, decryptSecret } from '@/lib/security/crypto'
import type { Prisma, CliDeviceAuthorization } from '@prisma/client'
import { requireActiveAccountForWrite } from '@/lib/auth/account-availability'
import {
  generateApiKey,
  MAX_ACTIVE_API_KEYS,
} from '@/lib/security/api-keys'
import {
  DEVELOPER_KEY_SCOPE_PRESETS,
  DEFAULT_DEVELOPER_KEY_EXPIRY_DAYS,
  developerKeyExpiresAt,
} from '@/lib/mcp/developer-key-policy'

export const CLI_DEVICE_EXPIRES_SECONDS = 10 * 60
export const CLI_DEVICE_POLL_SECONDS = 5

function hash(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

export function normalizeUserCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function hashCliDeviceCode(value: string): string {
  return hash(value)
}

export function hashCliUserCode(value: string): string {
  return hash(normalizeUserCode(value))
}

function formatUserCode(value: string): string {
  return `${value.slice(0, 4)}-${value.slice(4, 8)}`
}

/** Expiry owns only credentials that were approved but never collected. The
 * conditional claim and revocation commit together against competing polls. */
async function revokeExpiredUncollectedCredential(
  tx: Prisma.TransactionClient,
  authorization: Pick<CliDeviceAuthorization, 'id' | 'apiKeyId' | 'userId'>,
  now: Date,
) {
  if (!authorization.apiKeyId || !authorization.userId) return
  const claimed = await tx.cliDeviceAuthorization.updateMany({
    where: {
      id: authorization.id, status: 'APPROVED', apiKeyId: authorization.apiKeyId,
      userId: authorization.userId, expiresAt: { lte: now },
    },
    data: { status: 'CONSUMED', encryptedCredential: null, consumedAt: now },
  })
  if (claimed.count) {
    await tx.apiKey.updateMany({
      where: { id: authorization.apiKeyId, userId: authorization.userId, revokedAt: null },
      data: { revokedAt: now },
    })
  }
}

export async function createCliDeviceAuthorization(baseUrl: string) {
  const deviceCode = randomBytes(32).toString('base64url')
  const userCode = formatUserCode(
    randomBytes(6)
      .toString('base64url')
      .replace(/[^A-Z0-9]/gi, '')
      .toUpperCase()
      .slice(0, 8)
      .padEnd(8, 'X')
  )
  const expiresAt = new Date(Date.now() + CLI_DEVICE_EXPIRES_SECONDS * 1000)

  const cleanupAt = new Date()
  const expired = await prisma.cliDeviceAuthorization.findMany({
    where: { expiresAt: { lte: cleanupAt } },
    orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }], take: 100,
    select: { id: true, apiKeyId: true, userId: true },
  })
  if (expired.length) await prisma.$transaction(async tx => {
    for (const authorization of expired) await revokeExpiredUncollectedCredential(tx, authorization, cleanupAt)
    await tx.cliDeviceAuthorization.deleteMany({
      where: { id: { in: expired.map(({ id }) => id) }, expiresAt: { lte: cleanupAt } },
    })
  })
  await prisma.cliDeviceAuthorization.create({
    data: {
      deviceCodeHash: hashCliDeviceCode(deviceCode),
      userCodeHash: hashCliUserCode(userCode),
      intervalSeconds: CLI_DEVICE_POLL_SECONDS,
      expiresAt,
    },
  })

  const verificationUri = `${baseUrl.replace(/\/$/, '')}/cli/authorize`
  return {
    deviceCode,
    userCode,
    verificationUri,
    verificationUriComplete: `${verificationUri}?user_code=${encodeURIComponent(userCode)}`,
    expiresIn: CLI_DEVICE_EXPIRES_SECONDS,
    interval: CLI_DEVICE_POLL_SECONDS,
  }
}

export async function getCliAuthorizationForUserCode(userCode: string) {
  return prisma.cliDeviceAuthorization.findUnique({
    where: { userCodeHash: hashCliUserCode(userCode) },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      approvedAt: true,
    },
  })
}

export async function decideCliDeviceAuthorization(input: {
  userCode: string
  userId: string
  approve: boolean
}) {
  return prisma.$transaction(async (tx) => {
    // Approval shares the developer-key limit and account lifecycle lock with
    // Settings. Then serialize every terminal decision on this one-use code.
    if (input.approve) await requireActiveAccountForWrite(tx, input.userId)
    await tx.$queryRaw`SELECT id FROM cli_device_authorizations WHERE "userCodeHash" = ${hashCliUserCode(input.userCode)} FOR UPDATE`
    const authorization = await tx.cliDeviceAuthorization.findUnique({
      where: { userCodeHash: hashCliUserCode(input.userCode) },
    })
    if (!authorization || authorization.expiresAt <= new Date()) {
      return { ok: false as const, code: 'EXPIRED_DEVICE_CODE' }
    }
    if (authorization.status !== 'PENDING') {
      return { ok: false as const, code: 'DEVICE_CODE_ALREADY_USED' }
    }
    if (!input.approve) {
      await tx.cliDeviceAuthorization.update({
        where: { id: authorization.id },
        data: { status: 'DENIED', userId: input.userId },
      })
      return { ok: true as const, status: 'DENIED' as const }
    }

    const activeCount = await tx.apiKey.count({
      where: {
        userId: input.userId,
        revokedAt: null,
        audience: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    })
    if (activeCount >= MAX_ACTIVE_API_KEYS) {
      return { ok: false as const, code: 'API_KEY_LIMIT' }
    }

    const generated = generateApiKey()
    const fullAccess = DEVELOPER_KEY_SCOPE_PRESETS.find((preset) => preset.id === 'fix_and_verify')!
    const apiKey = await tx.apiKey.create({
      data: {
        userId: input.userId,
        name: 'FixFlags CLI',
        client: 'cli',
        keyHash: generated.keyHash,
        prefix: generated.prefix,
        lastFour: generated.lastFour,
        scopes: [...fullAccess.scopes],
        expiresAt: developerKeyExpiresAt(DEFAULT_DEVELOPER_KEY_EXPIRY_DAYS),
      },
    })
    await tx.cliDeviceAuthorization.update({
      where: { id: authorization.id },
      data: {
        status: 'APPROVED',
        userId: input.userId,
        apiKeyId: apiKey.id,
        approvedAt: new Date(),
        encryptedCredential: encryptSecret(generated.rawKey),
      },
    })
    return { ok: true as const, status: 'APPROVED' as const }
  })
}

export async function exchangeCliDeviceCode(deviceCode: string) {
  const now = new Date()
  const authorization = await prisma.cliDeviceAuthorization.findUnique({
    where: { deviceCodeHash: hashCliDeviceCode(deviceCode) },
  })
  if (!authorization) return { ok: false as const, code: 'INVALID_DEVICE_CODE' }
  if (authorization.status === 'CONSUMED') return { ok: false as const, code: 'DEVICE_CODE_ALREADY_USED' }
  if (authorization.expiresAt <= now) {
    await prisma.$transaction(async tx => {
      await revokeExpiredUncollectedCredential(tx, authorization, now)
      await tx.cliDeviceAuthorization.updateMany({
        where: { id: authorization.id, status: { not: 'CONSUMED' }, expiresAt: { lte: now } },
        data: {
          status: 'CONSUMED',
          encryptedCredential: null,
          consumedAt: now,
        },
      })
    })
    return { ok: false as const, code: 'EXPIRED_DEVICE_CODE' }
  }
  if (
    authorization.lastPolledAt &&
    now.getTime() - authorization.lastPolledAt.getTime() <
      authorization.intervalSeconds * 1000
  ) {
    return {
      ok: false as const,
      code: 'SLOW_DOWN',
      retryAfter: authorization.intervalSeconds,
    }
  }
  await prisma.cliDeviceAuthorization.update({
    where: { id: authorization.id },
    data: { lastPolledAt: now },
  })

  if (authorization.status === 'PENDING') {
    return { ok: false as const, code: 'AUTHORIZATION_PENDING' }
  }
  if (authorization.status === 'DENIED') {
    return { ok: false as const, code: 'ACCESS_DENIED' }
  }
  if (
    authorization.status !== 'APPROVED' ||
    !authorization.encryptedCredential
  ) {
    return { ok: false as const, code: 'DEVICE_CODE_ALREADY_USED' }
  }

  // Keep the one-use grant available if its stored credential cannot be read.
  const accessToken = decryptSecret(authorization.encryptedCredential)
  const consumed = await prisma.cliDeviceAuthorization.updateMany({
    where: { id: authorization.id, status: 'APPROVED' },
    data: {
      status: 'CONSUMED',
      encryptedCredential: null,
      consumedAt: now,
    },
  })
  if (consumed.count !== 1) {
    return { ok: false as const, code: 'DEVICE_CODE_ALREADY_USED' }
  }

  return {
    ok: true as const,
    accessToken,
    tokenType: 'Bearer' as const,
  }
}
