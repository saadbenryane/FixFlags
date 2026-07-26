import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '@/lib/db'
import { encryptSecret, decryptSecret } from '@/lib/security/crypto'
import {
  generateApiKey,
  MAX_ACTIVE_API_KEYS,
} from '@/lib/security/api-keys'

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

  const expired = await prisma.cliDeviceAuthorization.findMany({
    where: { expiresAt: { lt: new Date() } },
    select: { id: true, apiKeyId: true },
  })
  const expiredApiKeyIds = expired
    .map(({ apiKeyId }) => apiKeyId)
    .filter((apiKeyId): apiKeyId is string => Boolean(apiKeyId))
  await prisma.$transaction([
    ...(expiredApiKeyIds.length
      ? [
          prisma.apiKey.updateMany({
            where: { id: { in: expiredApiKeyIds }, revokedAt: null },
            data: { revokedAt: new Date() },
          }),
        ]
      : []),
    prisma.cliDeviceAuthorization.deleteMany({
      where: { id: { in: expired.map(({ id }) => id) } },
    }),
  ])
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
      where: { userId: input.userId, revokedAt: null },
    })
    if (activeCount >= MAX_ACTIVE_API_KEYS) {
      return { ok: false as const, code: 'API_KEY_LIMIT' }
    }

    const generated = generateApiKey()
    const apiKey = await tx.apiKey.create({
      data: {
        userId: input.userId,
        name: 'FixFlags CLI',
        client: 'cli',
        keyHash: generated.keyHash,
        prefix: generated.prefix,
        lastFour: generated.lastFour,
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
  if (authorization.expiresAt <= now) {
    await prisma.$transaction([
      ...(authorization.apiKeyId
        ? [
            prisma.apiKey.updateMany({
              where: { id: authorization.apiKeyId, revokedAt: null },
              data: { revokedAt: now },
            }),
          ]
        : []),
      prisma.cliDeviceAuthorization.update({
        where: { id: authorization.id },
        data: {
          status: 'CONSUMED',
          encryptedCredential: null,
          consumedAt: now,
        },
      }),
    ])
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
    accessToken: decryptSecret(authorization.encryptedCredential),
    tokenType: 'Bearer' as const,
  }
}
