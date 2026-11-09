import type { AdminOperation, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertAdminActor } from "./security";
import { AdminActionError } from "./errors";

export type AdminDomainActor = {
  kind: "admin";
  actorId: string;
  operationId: string;
  executionToken: string;
};
type ExpectedDomainAction = 'UPTIME_NOTIFICATION_RETRY' | 'WATCH_NOTIFICATION_RETRY';
export type AdminSiteOperationScope = { actor: AdminDomainActor; projectId: string; userId: string; cleanup?: boolean;
  expectedAction?: ExpectedDomainAction };

function operationAccessDenied() {
  return new AdminActionError("Operator execution is not admitted.", 403, "ADMIN_DOMAIN_ACCESS_DENIED");
}

export function adminDomainActorForOperation(operation: Pick<AdminOperation, "id" | "actorId" | "executionToken">): AdminDomainActor {
  if (!operation.executionToken) throw operationAccessDenied();
  return { kind: "admin", actorId: operation.actorId, operationId: operation.id, executionToken: operation.executionToken };
}

export async function assertAdminDomainActor(
  actor: AdminDomainActor,
  ownerId: string,
  projectId: string,
  db: Prisma.TransactionClient = prisma,
  expectedAction?: ExpectedDomainAction,
) {
  const operation = await db.adminOperation.findUnique({
    where: { id: actor.operationId },
  });
  if (
    !operation ||
    operation.actorId !== actor.actorId ||
    operation.ownerId !== ownerId ||
    operation.status !== "RUNNING" ||
    operation.executionToken !== actor.executionToken ||
    !operation.leaseUntil ||
    operation.leaseUntil <= new Date()
  )
    throw operationAccessDenied();
  if (
    expectedAction ? operation.action !== expectedAction : ![
      "SITE_CHECK",
      "SITE_RECONCILE",
      "AUDIT_RETRY",
      "SITE_ACCOUNT_RECONCILE",
      "SITE_ACCOUNT_CLEANUP",
      "USER_REMOVE",
    ].includes(operation.action)
  )
    throw new AdminActionError(
      "This operation cannot admit execution.",
      403,
      "ADMIN_DOMAIN_ACTION_DENIED",
    );
  const targetSite =
    operation.targetType === "USER" && operation.action === "USER_REMOVE"
      ? (
          await db.project.findFirst({
            where: { id: projectId, userId: ownerId },
            select: { id: true },
          })
        )?.id
      : operation.targetType === "SITE"
        ? operation.targetId
        : operation.targetType === "AUDIT"
          ? (
              await db.audit.findUnique({
                where: { id: operation.targetId },
                select: { projectId: true },
              })
            )?.projectId
          : operation.targetType === "UPTIME_NOTIFICATION" && operation.action === "UPTIME_NOTIFICATION_RETRY"
            ? (await db.uptimeNotification.findUnique({ where: { id: operation.targetId },
                select: { incident: { select: { monitor: { select: { projectId: true } } } } },
              }))?.incident.monitor.projectId
            : null;
  if (targetSite !== projectId)
    throw new AdminActionError(
      "This action belongs to another Site.",
      403,
      "ADMIN_DOMAIN_SCOPE_DENIED",
    );
  await assertAdminActor(db, {
    id: operation.actorId,
    sessionId: operation.actorSessionId,
    authenticatedAt: operation.actorAuthenticatedAt,
    role: "admin",
    email: "",
  });
  return operation;
}

/** Keep the operation, role and session stable for the caller's short write. */
export async function lockAdminDomainActor(actor: AdminDomainActor, ownerId: string, projectId: string, tx: Prisma.TransactionClient,
  expectedAction?: ExpectedDomainAction) {
  const [locked] = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT op.id FROM admin_operations op JOIN users u ON u.id = op."actorId"
    JOIN sessions s ON s.id = op."actorSessionId" AND s."userId" = u.id
    WHERE op.id = ${actor.operationId} AND op."actorId" = ${actor.actorId} AND op."executionToken" = ${actor.executionToken}
    FOR SHARE OF op, u, s`
  const operation = await assertAdminDomainActor(actor, ownerId, projectId, tx, expectedAction);
  if (!locked) throw operationAccessDenied();
  return operation;
}

/** Retain the admitted Site and owner through a short operator write. */
export async function lockAdminSiteOperation(scope: AdminSiteOperationScope, tx: Prisma.TransactionClient, auditId?: string) {
  const changed = () => new AdminActionError("This Site changed before execution. Review a new action.", 409, "TARGET_CHANGED");
  const [owner] = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM users WHERE id = ${scope.userId} AND (${Boolean(scope.cleanup)} OR "lifecycleStatus" = 'ACTIVE') FOR SHARE`;
  if (!owner) throw changed();
  const [site] = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM projects WHERE id = ${scope.projectId} AND "userId" = ${scope.userId}
      AND (${Boolean(scope.cleanup)} OR "deletedAt" IS NULL)
    FOR NO KEY UPDATE`;
  if (!site) throw changed();
  if (auditId) {
    const [audit] = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM audits WHERE id = ${auditId} AND "projectId" = ${scope.projectId} AND "userId" = ${scope.userId} FOR NO KEY UPDATE`;
    if (!audit) throw changed();
  }
  const operation = await lockAdminDomainActor(scope.actor, scope.userId, scope.projectId, tx, scope.expectedAction);
  if (scope.cleanup && operation.action !== "USER_REMOVE" && operation.action !== "SITE_ACCOUNT_CLEANUP") throw operationAccessDenied();
}
