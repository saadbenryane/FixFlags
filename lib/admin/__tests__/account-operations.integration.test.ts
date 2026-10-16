import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  accountsAwaitingAction,
  requiresAccountCleanup,
} from "../account-operations";

const run =
  process.env.ACCOUNT_OPERATIONS_DB_REQUIRED === "true"
    ? describe
    : describe.skip;
run("operator account cleanup visibility in PostgreSQL", () => {
  let userId: string;
  beforeEach(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (
      !["localhost", "127.0.0.1"].includes(url.hostname) ||
      !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(url.pathname)
    )
      throw new Error("Use the disposable execution verifier");
    userId = "cleanup-operator-" + randomUUID();
    await prisma.user.create({
      data: { id: userId, email: userId + "@example.test" },
    });
  });
  afterEach(async () => {
    await prisma.project.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
  });
  it("keeps removed and opted-out accounts actionable without flagging healthy retained accounts", async () => {
    const now = new Date(),
      interrupted = new Date(now.getTime() - 900000);
    const cases = [
      {
        name: "removed-active",
        state: "ACTIVE",
        removed: true,
        enabled: true,
        stale: false,
        expected: true,
      },
      {
        name: "removed-reserved",
        state: "RESERVED",
        removed: true,
        enabled: true,
        stale: false,
        expected: true,
      },
      {
        name: "opted-out-active",
        state: "ACTIVE",
        removed: false,
        enabled: false,
        stale: false,
        expected: true,
      },
      {
        name: "removed-deleted",
        state: "DELETED",
        removed: true,
        enabled: false,
        stale: true,
        expected: false,
      },
      {
        name: "healthy-retained",
        state: "ACTIVE",
        removed: false,
        enabled: true,
        stale: true,
        expected: false,
      },
      {
        name: "fresh-submission",
        state: "SUBMITTING",
        removed: false,
        enabled: true,
        stale: false,
        expected: false,
      },
      ...["SUBMITTING", "VERIFYING", "DELETING"].map((state) => ({
        name: "interrupted-" + state,
        state,
        removed: false,
        enabled: true,
        stale: true,
        expected: true,
      })),
    ];
    for (const sample of cases) {
      const site = await prisma.project.create({
        data: {
          userId,
          name: sample.name,
          url: "https://example.test/",
          canonicalHost: sample.name + ".test",
          deletedAt: sample.removed ? now : null,
          accountChecksEnabled: sample.enabled,
        },
      });
      await prisma.siteTestAccount.create({
        data: {
          projectId: site.id,
          origin: site.url,
          purpose: "retained",
          email: sample.name + "@example.test",
          encryptedPassword: "unusable-test-credentials",
          signupUrl: site.url,
          flowFingerprint: "controlled",
          state: sample.state,
          updatedAt: sample.stale ? new Date(interrupted.getTime() - 1) : now,
        },
      });
    }
    const rows = await prisma.siteTestAccount.findMany({
      where: { project: { userId }, AND: accountsAwaitingAction(interrupted) },
      include: { project: true },
    });
    expect(rows.map((row) => row.project.name).sort()).toEqual(
      cases
        .filter((sample) => sample.expected)
        .map((sample) => sample.name)
        .sort(),
    );
    for (const row of rows)
      expect(requiresAccountCleanup(row.project)).toBe(
        row.project.name.startsWith("removed-") ||
          row.project.name.startsWith("opted-out-"),
      );
  });
});
