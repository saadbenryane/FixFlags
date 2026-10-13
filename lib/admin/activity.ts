import type { AdminOperation, Prisma } from '@prisma/client'
import { safeActivityDetail } from './security'

export async function appendAdminActivity(
  tx: Prisma.TransactionClient,
  operation: Pick<AdminOperation, 'id' | 'actorId' | 'action' | 'targetType' | 'targetId'>,
  type: string,
  detail: Record<string, unknown> = {},
) {
  return tx.adminActivityEvent.create({
    data: {
      operationId: operation.id,
      actorId: operation.actorId,
      action: operation.action,
      targetType: operation.targetType,
      targetId: operation.targetId,
      type,
      detail: safeActivityDetail(detail) as Prisma.InputJsonObject,
    },
  })
}
