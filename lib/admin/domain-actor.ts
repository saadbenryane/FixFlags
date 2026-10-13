import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertAdminActor } from "./security";
import { AdminActionError } from "./errors";

export type AdminDomainActor = {
  kind: "admin";
  actorId: string;
  operationId: string;
};

export async function assertAdminDomainActor(
  actor: AdminDomainActor,
  ownerId: string,
  projectId: string,
  db: Prisma.TransactionClient = prisma,
) {
  const operation = await db.adminOperation.findUnique({
    where: { id: actor.operationId },
  });
  if (
    !operation ||
    operation.actorId !== actor.actorId ||
    operation.ownerId !== ownerId ||
    operation.status !== "RUNNING" ||
    !operation.executionToken ||
    !operation.leaseUntil ||
    operation.leaseUntil <= new Date()
  )
    throw new AdminActionError(
      "Operator execution is not admitted.",
      403,
      "ADMIN_DOMAIN_ACCESS_DENIED",
    );
  if (
    ![
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
}
