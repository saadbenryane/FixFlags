import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

export const SITE_EVENT_VERSION = 1

export const SITE_LIFECYCLE_EVENTS = [
  'analyze_started',
  'first_useful_result',
  'site_claimed',
  'flag_opened',
  'fix_handoff',
  'verify_started',
  'verify_result',
  'watch_enabled',
  'notification_sent',
  'notification_returned',
  'agent_answered',
  'agent_escalated',
  'support_resolved',
] as const

export type SiteLifecycleEventName = (typeof SITE_LIFECYCLE_EVENTS)[number]

const PRIVATE_KEY = /(url|email|prompt|evidence|html|content|message|transcript)/i

function safeProperties(properties: Record<string, string | number | boolean | null | undefined> = {}) {
  return Object.fromEntries(
    Object.entries(properties)
      .filter(([key, value]) => !PRIVATE_KEY.test(key) && value !== undefined)
      .map(([key, value]) => [key, value ?? null])
  ) as Prisma.InputJsonObject
}

/** Durable, idempotent lifecycle telemetry. Never stores customer content or raw URLs. */
export async function recordSiteLifecycleEvent(input: {
  name: SiteLifecycleEventName
  idempotencyKey: string
  userId?: string | null
  projectId?: string | null
  properties?: Record<string, string | number | boolean | null | undefined>
}) {
  return prisma.siteLifecycleEvent.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    create: {
      name: input.name,
      version: SITE_EVENT_VERSION,
      idempotencyKey: input.idempotencyKey,
      userId: input.userId ?? null,
      projectId: input.projectId ?? null,
      properties: safeProperties(input.properties),
    },
    update: {},
  })
}
