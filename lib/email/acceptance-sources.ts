import { Prisma } from '@prisma/client'
import type { EmailDeliveryChannel } from './delivery-state'

type AcceptanceSource = { providerId: string; userId: string; email: string; channel: EmailDeliveryChannel;
  sourceId: string; acceptedAt: Date; firstAttemptAt: string | null }
type Selection = { dueAt: Date } | { userId: string }

/** A saved acceptance remains authoritative while the delivery ledger catches up. */
export function readUnprojectedEmailAcceptances(db: Pick<Prisma.TransactionClient, '$queryRaw'>, since: Date,
  limit: number, selection: Selection) {
  const due = (column: Prisma.Sql, nullable = false) => 'dueAt' in selection
    ? Prisma.sql`AND (${column} <= ${selection.dueAt} ${nullable ? Prisma.sql`OR ${column} IS NULL` : Prisma.empty})` : Prisma.empty
  const owner = (column: Prisma.Sql) => 'userId' in selection ? Prisma.sql`AND ${column} = ${selection.userId}` : Prisma.empty
  const history = 'userId' in selection
  return db.$queryRaw<AcceptanceSource[]>(Prisma.sql`
    SELECT source.* FROM (
      SELECT d."providerId", d."userId", d.payload->>'to' AS email, 'summary' AS channel, d.id AS "sourceId",
        d."sentAt" AS "acceptedAt", d.payload->>'firstAttemptAt' AS "firstAttemptAt"
      FROM notification_digests d
      WHERE d.status = 'SENT' AND d."deliveryProjectedAt" IS NULL AND d."sentAt" >= ${since}
        AND d."providerId" IS NOT NULL AND d.payload->>'to' IS NOT NULL
        ${owner(Prisma.sql`d."userId"`)} ${due(Prisma.sql`d."nextAttemptAt"`)}
      UNION ALL
      SELECT a."watchNotificationProviderId", u.id, a."watchNotificationPayload"->>'to', 'watch', a.id,
        a."watchNotifiedAt", a."watchNotificationPayload"->>'firstAttemptAt'
      FROM audits a JOIN users u ON u.id = COALESCE(a."watchNotificationPayload"->>'receiptOwnerId', a."userId")
      WHERE a."watchNotificationStatus" = 'SENT' AND a."watchDeliveryProjectedAt" IS NULL AND a."watchNotifiedAt" >= ${since}
        AND a."watchNotificationProviderId" IS NOT NULL AND a."watchNotificationPayload"->>'to' IS NOT NULL
        ${owner(Prisma.sql`u.id`)} ${due(Prisma.sql`a."watchNotificationNextAttemptAt"`, true)}
      UNION ALL
      SELECT n."providerId", u.id, n."deliveryPayload"->>'to', 'uptime', n.id, n."sentAt", n."deliveryPayload"->>'firstAttemptAt'
      FROM uptime_notifications n JOIN users u ON u.id = n."deliveryPayload"->>'ownerId'
      WHERE n.status = 'SENT' AND n."deliveryProjectedAt" IS NULL AND n."sentAt" >= ${since}
        AND n."providerId" IS NOT NULL AND n."deliveryPayload"->>'to' IS NOT NULL
        ${owner(Prisma.sql`u.id`)} ${due(Prisma.sql`n."nextAttemptAt"`)}
      UNION ALL
      SELECT l."providerId", l."userId", l.payload->>'to', 'onboarding', l.id, l."sentAt", l.payload->>'firstAttemptAt'
      FROM email_logs l
      WHERE l.status = 'SENT' AND l."deliveryProjectedAt" IS NULL AND l."sentAt" >= ${since}
        AND l."providerId" IS NOT NULL AND l.payload->>'to' IS NOT NULL
        ${owner(Prisma.sql`l."userId"`)} ${due(Prisma.sql`l."nextAttemptAt"`, true)}
    ) source
    ${history ? Prisma.sql`WHERE NOT EXISTS (SELECT 1 FROM email_deliveries d WHERE d."providerId" = source."providerId")
      ORDER BY source."acceptedAt" DESC, source."providerId" DESC`
      : Prisma.sql`ORDER BY source."acceptedAt" ASC, source.channel ASC, source."sourceId" ASC`}
    LIMIT ${limit}`)
}
