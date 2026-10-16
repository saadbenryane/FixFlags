import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
const fixture = vi.hoisted(() => ({
  data: null as Record<string, unknown> | null,
}));
vi.mock("@/lib/auth/require-admin-page", () => ({
  requireAdminPage: async () => ({ id: "admin" }),
}));
vi.mock("@/lib/admin/workspace-queries", () => ({
  loadAdminSite: async () => fixture.data,
}));
vi.mock("@/components/admin/SiteControls", () => ({
  SiteControls: () => <p>Active website controls</p>,
}));
vi.mock("@/components/admin/AdminActionButton", () => ({
  AdminActionButton: ({ action }: { action: string }) => (
    <button>{action}</button>
  ),
}));
import SitePage from "../page";
beforeEach(() => {
  cleanup();
  fixture.data = {
    id: "removed",
    name: "Removed website",
    deletedAt: new Date(),
    user: {
      id: "owner",
      email: "owner@example.test",
      lifecycleStatus: "ACTIVE",
    },
    testAccounts: [{ id: "remaining", state: "ACTIVE", lastCheckedAt: null }],
    audits: [],
    shopifyShops: [],
  };
});
describe("removed website account cleanup", () => {
  it("keeps cleanup available while routine website controls are hidden", async () => {
    render(await SitePage({ params: Promise.resolve({ id: "removed" }) }));
    expect(
      screen.getByRole("button", { name: "SITE_ACCOUNT_CLEANUP" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Active website controls"),
    ).not.toBeInTheDocument();
  });
  it("does not offer cleanup after all accounts are deleted", async () => {
    fixture.data!.testAccounts = [
      { id: "deleted", state: "DELETED", lastCheckedAt: null },
    ];
    render(await SitePage({ params: Promise.resolve({ id: "removed" }) }));
    expect(
      screen.queryByRole("button", { name: "SITE_ACCOUNT_CLEANUP" }),
    ).not.toBeInTheDocument();
  });
});
