import { createHash, randomBytes } from 'node:crypto'
import { z } from 'zod'
import { Prisma, type ProductSignalKind } from '@prisma/client'
import { prisma } from '@/lib/db'
import { hashApiKey } from '@/lib/security/api-keys'
import { canAccessProductWatch } from '@/lib/auth/entitlements'

const SIGNAL_RETENTION_DAYS = 30
const MAX_BATCH_SIZE = 50
const MAX_ACTIVE_SIGNAL_KEYS = 3
const signalName = z.string().trim().min(1).max(100).regex(/^[a-zA-Z0-9 _./:-]+$/)

const eventSchema = z
  .object({
    id: z.string().min(8).max(100),
    kind: z.enum(['NAVIGATION', 'ACTION', 'OUTCOME', 'ERROR', 'PERFORMANCE', 'DEPLOYMENT']),
    name: signalName,
    route: z.string().max(500).optional(),
    session: z.string().min(8).max(100).optional(),
    release: z.string().trim().min(1).max(120).optional(),
    occurredAt: z.string().datetime(),
    numericValue: z.number().finite().min(0).max(10_000_000).optional(),
  })
  .strict()

const batchSchema = z
  .object({
    key: z.string().min(20).max(200),
    events: z.array(eventSchema).min(1).max(MAX_BATCH_SIZE),
  })
  .strict()

export type ProductSignalBatch = z.infer<typeof batchSchema>

export function normalizeSignalOrigin(value: string): string {
  const url = new URL(value)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Signal origin must use HTTP or HTTPS')
  }
  return url.origin.toLowerCase()
}

export function sanitizeSignalRoute(value: string | undefined, origin: string): string | null {
  if (!value) return null
  const url = new URL(value, origin)
  if (url.origin.toLowerCase() !== origin.toLowerCase()) {
    throw new Error('Signal route must use the configured origin')
  }
  return url.pathname.slice(0, 300) || '/'
}

function hashSession(projectId: string, session: string | undefined): string | null {
  if (!session) return null
  return createHash('sha256').update(`${projectId}:${session}`, 'utf8').digest('hex')
}

export async function issueProductSignalKey(input: {
  projectId: string
  userId: string
  name: string
  allowedOrigin: string
}) {
  const product = await prisma.project.findFirst({
    where: {
      id: input.projectId,
      userId: input.userId,
      audits: { some: { status: 'COMPLETED' } },
    },
    select: {
      id: true,
      user: { select: { id: true, role: true, plan: true, subscriptionStatus: true } },
    },
  })
  if (!product) throw new Error('Product must have a completed Review before Watch setup')
  if (!canAccessProductWatch(product.user)) {
    throw new Error('Product Signals require Product Watch access')
  }
  const activeKeys = await prisma.productSignalKey.count({
    where: { projectId: input.projectId, revokedAt: null },
  })
  if (activeKeys >= MAX_ACTIVE_SIGNAL_KEYS) {
    throw new Error('Product Signal key limit reached')
  }

  const rawKey = `ff_sig_${randomBytes(24).toString('base64url')}`
  const allowedOrigin = normalizeSignalOrigin(input.allowedOrigin)
  const record = await prisma.productSignalKey.create({
    data: {
      projectId: input.projectId,
      name: input.name.trim().slice(0, 80) || 'Browser snippet',
      keyHash: hashApiKey(rawKey),
      prefix: rawKey.slice(0, 12),
      lastFour: rawKey.slice(-4),
      allowedOrigin,
    },
    select: { id: true, name: true, prefix: true, lastFour: true, allowedOrigin: true },
  })
  return { ...record, key: rawKey }
}

export async function ingestProductSignals(input: {
  projectId: string
  origin: string
  payload: unknown
}): Promise<{ accepted: number; duplicates: number }> {
  const parsed = batchSchema.parse(input.payload)
  const origin = normalizeSignalOrigin(input.origin)
  const signalKey = await prisma.productSignalKey.findFirst({
    where: {
      projectId: input.projectId,
      keyHash: hashApiKey(parsed.key),
      allowedOrigin: origin,
      revokedAt: null,
    },
    select: {
      id: true,
      project: {
        select: {
          user: { select: { id: true, role: true, plan: true, subscriptionStatus: true } },
        },
      },
    },
  })
  if (!signalKey) throw new Error('Invalid Product Signal key or origin')
  if (!canAccessProductWatch(signalKey.project.user)) {
    throw new Error('Product Signals require Product Watch access')
  }

  const now = new Date()
  const oldest = now.getTime() - 24 * 60 * 60 * 1000
  const newest = now.getTime() + 5 * 60 * 1000
  const expiresAt = new Date(now.getTime() + SIGNAL_RETENTION_DAYS * 24 * 60 * 60 * 1000)
  const releaseIds = new Map<string, string>()
  for (const event of parsed.events) {
    const occurredAt = new Date(event.occurredAt)
    if (occurredAt.getTime() < oldest || occurredAt.getTime() > newest) {
      throw new Error('Signal timestamp is outside the accepted window')
    }
    if (!event.release) continue
    const release = await prisma.productRelease.upsert({
      where: {
        projectId_source_externalId: {
          projectId: input.projectId,
          source: 'fixflags-browser',
          externalId: event.release,
        },
      },
      create: {
        projectId: input.projectId,
        source: 'fixflags-browser',
        externalId: event.release,
        url: origin,
        deployedAt: occurredAt,
      },
      update: {},
      select: { id: true },
    })
    releaseIds.set(event.release, release.id)
  }

  const result = await prisma.productSignal.createMany({
    data: parsed.events.map((event) => ({
      projectId: input.projectId,
      source: 'fixflags-browser',
      kind: event.kind as ProductSignalKind,
      name: event.name,
      route: sanitizeSignalRoute(event.route, origin),
      sessionHash: hashSession(input.projectId, event.session),
      releaseId: event.release ? releaseIds.get(event.release) : undefined,
      occurredAt: new Date(event.occurredAt),
      numericValue: event.numericValue,
      provenance: {
        source: 'fixflags-browser',
        keyId: signalKey.id,
        origin,
        schemaVersion: 1,
        truthClass: 'OBSERVED',
      } satisfies Prisma.InputJsonObject,
      replayKey: event.id,
      expiresAt,
    })),
    skipDuplicates: true,
  })
  await prisma.productSignalKey.update({
    where: { id: signalKey.id },
    data: { lastUsedAt: now },
  })
  return { accepted: result.count, duplicates: parsed.events.length - result.count }
}

export async function deleteExpiredProductSignals(now = new Date()): Promise<number> {
  const result = await prisma.productSignal.deleteMany({ where: { expiresAt: { lte: now } } })
  return result.count
}

export async function recordProductReleaseForReview(input: {
  auditId: string
  source: string
  externalId: string
  commitRef?: string | null
  url?: string | null
  deployedAt?: Date
}) {
  const audit = await prisma.audit.findUnique({
    where: { id: input.auditId },
    select: { projectId: true },
  })
  if (!audit?.projectId) return null
  return prisma.productRelease.upsert({
    where: {
      projectId_source_externalId: {
        projectId: audit.projectId,
        source: input.source,
        externalId: input.externalId,
      },
    },
    create: {
      projectId: audit.projectId,
      source: input.source,
      externalId: input.externalId,
      commitRef: input.commitRef,
      url: input.url,
      deployedAt: input.deployedAt ?? new Date(),
    },
    update: {
      commitRef: input.commitRef,
      url: input.url,
    },
  })
}

export const PRODUCT_SIGNAL_POLICY = {
  retentionDays: SIGNAL_RETENTION_DAYS,
  maxBatchSize: MAX_BATCH_SIZE,
  maxActiveKeys: MAX_ACTIVE_SIGNAL_KEYS,
  allowedKinds: [
    'NAVIGATION',
    'ACTION',
    'OUTCOME',
    'ERROR',
    'PERFORMANCE',
    'DEPLOYMENT',
  ] as const,
}
