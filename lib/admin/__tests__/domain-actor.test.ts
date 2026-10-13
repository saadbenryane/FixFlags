import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ operation: vi.fn(), actor: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: { adminOperation: { findUnique: mocks.operation } },
}));
vi.mock("../security", () => ({ assertAdminActor: mocks.actor }));
import { assertAdminDomainActor } from "../domain-actor";
const actor = {
  kind: "admin" as const,
  actorId: "operator",
  operationId: "operation",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.operation.mockResolvedValue({
    actorId: "operator",
    ownerId: "owner",
    status: "RUNNING",
    executionToken: "lease",
    leaseUntil: new Date(Date.now() + 60000),
    action: "SITE_RECONCILE",
    targetType: "SITE",
    targetId: "site",
    actorSessionId: "session",
    actorAuthenticatedAt: new Date(),
  });
});
describe("operator execution scope", () => {
  it("admits a scoped reconciliation under a live operator lease", async () => {
    await assertAdminDomainActor(actor, "owner", "site");
    expect(mocks.actor).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: "operator", sessionId: "session" }),
    );
  });
  it("refuses an expired operation lease", async () => {
    const operation = await mocks.operation();
    mocks.operation.mockResolvedValue({
      ...operation,
      leaseUntil: new Date(0),
    });
    await expect(
      assertAdminDomainActor(actor, "owner", "site"),
    ).rejects.toMatchObject({ code: "ADMIN_DOMAIN_ACCESS_DENIED" });
    expect(mocks.actor).not.toHaveBeenCalled();
  });
  it("refuses another customer or site", async () => {
    await expect(
      assertAdminDomainActor(actor, "other-owner", "site"),
    ).rejects.toMatchObject({ code: "ADMIN_DOMAIN_ACCESS_DENIED" });
    await expect(
      assertAdminDomainActor(actor, "owner", "other-site"),
    ).rejects.toMatchObject({ code: "ADMIN_DOMAIN_SCOPE_DENIED" });
  });
});
