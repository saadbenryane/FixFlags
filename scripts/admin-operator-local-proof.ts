import "dotenv/config";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { chromium } from "playwright";
import { uploadScreenshot } from "@/lib/storage/screenshots";
import { signAdminIntent } from "@/lib/admin/security";
const base = "http://127.0.0.1:3117";
async function main() {
  if (!process.env.DATABASE_URL?.includes("/fixflags_admin_test_"))
    throw new Error("A dedicated admin test database is required.");
  if (process.env.REDIS_URL !== "redis://127.0.0.1:55440")
    throw new Error("Dedicated local Redis is required.");
  const db = new PrismaClient(),
    browser = await chromium.launch({ headless: true }),
    context = await browser.newContext(),
    page = await context.newPage(),
    customerContext = await browser.newContext(),
    customerPage = await customerContext.newPage();
  const prefix = `proof-${Date.now()}`,
    password = randomUUID() + "A1!",
    adminEmail = prefix + "@operator.invalid",
    customerEmail = prefix + "@customer.invalid";
  const artifacts = "/private/tmp/fixflags-admin-proof";
  await mkdir(artifacts, { recursive: true });
  const checks: string[] = [],
    errors: string[] = [];
  page.on("pageerror", (error) => { errors.push(`${page.url()}: ${error.stack ?? error.message}`); });
  async function api(
    target: typeof page,
    url: string,
    method = "GET",
    body?: unknown,
  ) {
    const response = await target.request.fetch(base + url, {
      method,
      headers: { "Content-Type": "application/json", Origin: base },
      ...(body ? { data: body } : {}),
    });
    const text = await response.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: response.status(), data };
  }

  async function settle(id: string) {
    for (let n = 0; n < 40; n++) {
      const op = await db.adminOperation.findUniqueOrThrow({ where: { id } });
      if (!["QUEUED", "RUNNING"].includes(op.status)) return op;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error("Worker did not settle admitted operation");
  }
  async function action(
    action: string,
    targetId: string,
    input: Record<string, unknown> = {},
  ) {
    const preview = await api(page, "/api/admin/actions/preview", "POST", {
      action,
      targetId,
      input,
      reason: "Local operator contract proof",
    });
    assert.equal(preview.status, 200, JSON.stringify(preview.data));
    const intent = (preview.data as { intent: string }).intent,
      key = randomUUID();
    const admitted = await api(page, "/api/admin/actions", "POST", {
      intent,
      idempotencyKey: key,
    });
    assert.ok(
      [200, 202].includes(admitted.status),
      JSON.stringify(admitted.data),
    );
    const receipt = admitted.data as { id: string };
    const replay = await api(page, "/api/admin/actions", "POST", {
      intent,
      idempotencyKey: key,
    });
    assert.equal((replay.data as { id: string }).id, receipt.id);
    const op = await settle(receipt.id);
    assert.equal(op.status, "SUCCEEDED", op.errorMessage ?? "Operation failed");
    checks.push(action + " confirmed and replayed once");
    return op;
  }
  try {
    await page.goto(base + "/admin");
    assert.match(page.url(), /sign-in/);
    checks.push("Anonymous admin page redirected");
    await customerPage.goto(base + "/sign-in");
    for (const [target, email] of [
      [page, adminEmail],
      [customerPage, customerEmail],
    ] as const) {
      const sign = await api(target, "/api/auth/sign-up/email", "POST", {
        email,
        password,
        name: "Local proof",
        role: "admin",
        plan: "TEAM",
        lifecycleStatus: "ACTIVE",
      });
      assert.ok([200, 201].includes(sign.status), JSON.stringify(sign.data));
      const user = await db.user.findUniqueOrThrow({ where: { email } });
      assert.equal(user.role, "user");
      assert.equal(user.plan, "FREE");
      await db.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      });
    }
    checks.push("Public signup cannot set role or commercial plan");
    const admin = await db.user.update({
        where: { email: adminEmail },
        data: { role: "admin" },
      }),
      customer = await db.user.findUniqueOrThrow({
        where: { email: customerEmail },
      });
    assert.equal(
      (
        await api(customerPage, "/api/admin/actions/preview", "POST", {
          action: "USER_SUSPEND",
          targetId: admin.id,
          input: {},
          reason: "Unauthorized request",
        })
      ).status,
      403,
    );
    checks.push("Authenticated customer cannot access admin actions");
    const login = await api(page, "/api/auth/sign-in/email", "POST", {
      email: adminEmail,
      password,
    });
    assert.equal(login.status, 200, JSON.stringify(login.data));
    const site = await db.project.create({
      data: {
        id: prefix + "-site",
        userId: customer.id,
        name: "Local proof Site",
        url: "https://example.invalid",
        canonicalHost: prefix + ".invalid",
      },
    });
    const audit = await db.audit.create({
      data: {
        id: prefix + "-audit",
        url: "https://example.invalid",
        userId: customer.id,
        projectId: site.id,
        status: "FAILED",
        failureCode: "PROOF_ONLY",
        isPublic: false,
      },
    });
    const tenant = await db.supportTenant.upsert({
      where: { slug: "fixflags" },
      create: { slug: "fixflags", name: "FixFlags" },
      update: {},
    });
    const session = await db.supportSession.create({
      data: {
        id: prefix + "-support",
        tenantId: tenant.id,
        userId: customer.id,
        projectId: site.id,
        visitorToken: randomUUID(),
        visitorEmail: customerEmail,
        status: "WAITING",
        unreadByAgent: 101,
        nextMessageSequence: 101,
        lastMessageAt: new Date(Date.now() - 300000),
      },
    });
    await db.supportMessage.createMany({
      data: Array.from({ length: 101 }, (_, i) => ({
        sessionId: session.id,
        role: "VISITOR" as const,
        sequence: i + 1,
        body: `Local proof message ${i + 1}`,
      })),
    });
    await db.supportSession.createMany({
      data: Array.from({ length: 205 }, (_, i) => ({
        id: prefix + "-listed-" + i,
        tenantId: tenant.id,
        visitorToken: randomUUID(),
        status: "OPEN" as const,
        lastMessageAt: new Date(),
      })),
    });
    const listed = await api(page, "/api/admin/support/sessions?filter=all");
    assert.equal((listed.data as { sessions: unknown[] }).sessions.length, 50);
    assert.equal(
      (await api(page, `/api/admin/support/sessions/${session.id}`)).status,
      200,
    );
    checks.push("Conversation selection works beyond list pages");
    const messages = await api(
      page,
      `/api/admin/support/sessions/${session.id}/messages`,
    );
    assert.equal(
      (messages.data as { messages: unknown[] }).messages.length,
      50,
    );
    await db.supportMessage.create({
      data: {
        sessionId: session.id,
        sequence: 102,
        role: "VISITOR",
        body: "Concurrent unread",
      },
    });
    await db.supportSession.update({
      where: { id: session.id },
      data: { nextMessageSequence: 102, unreadByAgent: { increment: 1 } },
    });
    assert.equal(
      (
        await api(
          page,
          `/api/admin/support/sessions/${session.id}/messages`,
          "PATCH",
          {
            through: "50",
          },
        )
      ).status,
      200,
    );
    assert.equal(
      (await db.supportSession.findUniqueOrThrow({ where: { id: session.id } }))
        .unreadByAgent,
      52,
    );
    checks.push("Read cursor preserves hidden and concurrent unread messages");
    const draft = await api(
      page,
      `/api/admin/support/sessions/${session.id}/draft`,
      "PUT",
      {
        body: "Saved local reply",
        revision: 0,
      },
    );
    assert.equal(draft.status, 200);
    assert.equal(
      (await api(page, `/api/admin/support/sessions/${session.id}/draft`))
        .status,
      200,
    );
    assert.equal(
      (
        await api(
          page,
          `/api/admin/support/sessions/${session.id}/draft`,
          "PUT",
          {
            body: "Overwrite",
            revision: 0,
          },
        )
      ).status,
      409,
    );
    checks.push("Draft persists and rejects a stale editor");
    await action("SUPPORT_REPLY", session.id, { body: "Saved local reply" });
    assert.equal(
      await db.supportMessage.count({
        where: { sessionId: session.id, role: "AGENT" },
      }),
      1,
    );
    const preview = await api(page, "/api/admin/actions/preview", "POST", {
      action: "SUPPORT_STATUS",
      targetId: session.id,
      input: { status: "CLOSED" },
      reason: "Stale target proof",
    });
    await db.supportSession.update({
      where: { id: session.id },
      data: { assignedAgentId: admin.id, status: "OPEN" },
    });
    assert.equal(
      (
        await api(page, "/api/admin/actions", "POST", {
          intent: (preview.data as { intent: string }).intent,
          idempotencyKey: randomUUID(),
        })
      ).status,
      409,
    );
    checks.push("Stale target confirmation is refused");
    const expiring = await api(page, "/api/admin/actions/preview", "POST", {
      action: "SUPPORT_STATUS",
      targetId: session.id,
      input: { status: "CLOSED" },
      reason: "Expired confirmation proof",
    });
    const payload = JSON.parse(
      Buffer.from(
        (expiring.data as { intent: string }).intent.split(".")[0],
        "base64url",
      ).toString(),
    );
    payload.expiresAt = Date.now() - 1;
    assert.equal(
      (
        await api(page, "/api/admin/actions", "POST", {
          intent: signAdminIntent(payload),
          idempotencyKey: randomUUID(),
        })
      ).status,
      409,
    );
    checks.push("Expired signed confirmation is refused");
    await action("ENTITLEMENT_GRANT", customer.id, {
      plan: "TEAM",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });
    await action("SITE_SET_SETTINGS", site.id, {
      notificationLevel: "CRITICAL_ONLY",
      notifyOnRecovery: true,
    });
    await action("USER_SUSPEND", customer.id);
    assert.equal(await db.session.count({ where: { userId: customer.id } }), 0);
    assert.equal(
      (
        await api(customerPage, "/api/auth/sign-in/email", "POST", {
          email: customerEmail,
          password,
        })
      ).status,
      403,
    );
    checks.push("Suspension revokes sessions and refuses login");
    await action("USER_REACTIVATE", customer.id);
    const paymentUnavailable = await api(
      page,
      "/api/admin/actions/preview",
      "POST",
      {
        action: "BILLING_RECONCILE",
        targetId: customer.id,
        input: {},
        reason: "Provider unavailable proof",
      },
    );
    assert.equal(paymentUnavailable.status, 503);
    checks.push("Provider unavailable is not reported as success");
    const capture = await page.screenshot(),
      captureUrl = await uploadScreenshot(
        audit.id,
        "desktop",
        capture,
        "proof-capture",
      );
    const screenshot = await db.screenshot.create({
      data: {
        auditId: audit.id,
        device: "DESKTOP",
        url: captureUrl,
        width: 1280,
        height: 720,
      },
    });
    const evidence = await action("EVIDENCE_ACCESS", audit.id),
      grant = (evidence.result as { grantId: string }).grantId;
    assert.equal((await api(page, `/api/admin/evidence/${grant}`)).status, 200);
    const captured = await page.request.get(
      base + `/api/admin/evidence/${grant}/screenshots/${screenshot.id}`,
    );
    assert.equal(captured.status(), 200);
    assert.deepEqual(await captured.body(), capture);
    assert.equal(
      (
        await page.request.get(
          base + `/api/screenshots/${audit.id}/desktop?page=proof-capture`,
        )
      ).status(),
      403,
    );
    checks.push(
      "Private capture bytes are available only through their session grant",
    );
    assert.ok(
      [401, 403].includes(
        (await api(customerPage, `/api/admin/evidence/${grant}`)).status,
      ),
    );
    checks.push("Private evidence grant is session bound");
    await db.auditFeedback.createMany({
      data: Array.from({ length: 505 }, (_, i) => ({
        auditId: audit.id,
        visitorToken: prefix + "-reaction-" + i,
        vote: i % 2 ? 1 : -1,
        comment: "proof-email@example.invalid",
      })),
    });
    const exported = await action("DATA_EXPORT", "feedback", { days: 30 }),
      download = (exported.result as { downloadUrl: string }).downloadUrl,
      response = await page.request.get(base + download),
      text = await response.text();
    assert.equal(response.status(), 200);
    assert.ok(text.includes("report reaction"));
    assert.ok((text.match(/report reaction /g) ?? []).length >= 505);
    assert.ok(!text.includes("proof-email@example.invalid"));
    checks.push("Export includes all batches and redacts email");
    const history = await db.adminActivityEvent.findFirstOrThrow({
      where: { operationId: evidence.id },
    });
    await assert.rejects(
      db.adminActivityEvent.update({
        where: { id: history.id },
        data: { type: "CHANGED" },
      }),
    );
    checks.push("Activity is append only in PostgreSQL");
    const consent = page.getByRole("button", { name: "Only necessary" });
    if (await consent.count()) await consent.click();
    const routes = [
      "/admin",
      "/admin/operations",
      "/admin/sites",
      "/admin/users",
      "/admin/feedback?tab=conversations",
      "/admin/analytics",
      "/admin/billing",
      "/admin/activity",
      `/admin/sites/${site.id}`,
      `/admin/users/${customer.id}`,
      `/admin/feedback?tab=conversations&session=${session.id}`,
    ];
    for (const route of routes) {
      const response = await page.goto(base + route);
      assert.equal(response?.status(), 200, route);
      await page.waitForLoadState("networkidle").catch(() => undefined);
      assert.equal(
        await page
          .getByRole("heading", { name: "Something went wrong", exact: false })
          .count(),
        0,
        route,
      );
    }
    for (const width of [320, 375, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base + "/admin");
      await page
        .getByRole("heading", { name: "Overview", exact: true })
        .waitFor();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `Overflow at ${width}`,
      );
      if (width < 1024) {
        await page
          .getByRole("button", { name: "Open admin navigation" })
          .click();
        await page.getByRole("dialog").waitFor();
        await page
          .getByRole("dialog")
          .getByRole("link", { name: "Operations", exact: true })
          .click();
        await page
          .getByRole("heading", { name: "Operations", exact: true })
          .waitFor();
      }
      await page.screenshot({
        path: `${artifacts}/admin-${width}.png`,
        fullPage: true,
      });
    }
    for (const scale of [2, 4]) {
      await page.setViewportSize({ width: 1280 / scale, height: 900 });
      await page.goto(base + "/admin");
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `Reflow at ${scale * 100}% equivalent viewport`,
      );
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(base + "/admin");
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.screenshot({
      path: artifacts + "/admin-dark.png",
      fullPage: true,
    });
    await page.keyboard.press("Tab");
    assert.ok(
      await page.evaluate(() => document.activeElement !== document.body),
    );
    checks.push(
      "Responsive widths, equivalent 200/400 percent reflow, themes, and keyboard entry verified",
    );
    await action("USER_REMOVE", customer.id);
    assert.equal(await db.user.count({ where: { id: customer.id } }), 0);
    assert.ok(
      (await db.adminOperation.count({ where: { ownerId: customer.id } })) > 0,
    );
    checks.push("Erasure removes the customer graph and retains activity");
    await db.adminEvidenceGrant.update({
      where: { id: grant },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    assert.equal((await api(page, `/api/admin/evidence/${grant}`)).status, 403);
    checks.push("Expired evidence access is refused");
    assert.deepEqual(errors, []);
    checks.push("Connected admin pages render without client exceptions");
    await writeFile(
      artifacts + "/receipt.json",
      JSON.stringify(
        {
          at: new Date().toISOString(),
          database: "isolated admin test database",
          base,
          checks,
          errors,
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify({ checks, artifacts }, null, 2));
  } finally {
    await browser.close();
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.stack?.slice(-1800) : "Proof failed",
  );
  process.exitCode = 1;
});
