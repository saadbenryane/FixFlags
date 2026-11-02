import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { notificationEmailSnapshotSchema } from '@/lib/email/notification-delivery'

export const monitored = { deletedAt: null, watchPausedAt: null, watchInterval: { not: null }, notificationLevel: { not: 'OFF' as const } }
export const dailyMonitoring: Prisma.ProjectWhereInput = { ...monitored, OR: [{ watchInterval: { in: ['DAILY', 'HOURLY'] } },
  { watchInterval: 'CUSTOM', watchEveryMinutes: { lte: 1440 } }] }
const scopeSchema = z.object({ id: z.string(), url: z.string(), watchInterval: z.enum(['DAILY', 'HOURLY', 'WEEKLY', 'CUSTOM']), watchEveryMinutes: z.number().nullable(),
  notificationLevel: z.enum(['FLAGS', 'CRITICAL_ONLY']), notifyOnRecovery: z.boolean() }).strict()
export const digestPayloadSchema = notificationEmailSnapshotSchema.extend({ ownerId: z.string(), revision: z.number().int(),
  sites: z.array(scopeSchema).min(1).max(20) }).strict()

