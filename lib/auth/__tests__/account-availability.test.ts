import { describe, it, expect, vi } from "vitest";
import { requireActiveAccountForWrite } from "../account-availability";
describe("credential admission with lifecycle changes", () => {
  it("requires the active account row lock before credential writes", async () => {
    const query = vi.fn(async (...args: [TemplateStringsArray, string]) => {
      expect(args[1]).toBe("owner");
      return [{ id: "owner" }];
    });
    await requireActiveAccountForWrite({ $queryRaw: query } as never, "owner");
    expect(query.mock.calls[0][0].join("")).toContain("FOR UPDATE");
    expect(query.mock.calls[0][1]).toBe("owner");
  });
  it("refuses a missing, suspended, or deleting account", async () => {
    await expect(
      requireActiveAccountForWrite(
        { $queryRaw: vi.fn(async () => []) } as never,
        "owner",
      ),
    ).rejects.toMatchObject({ status: 403, code: "ACCOUNT_UNAVAILABLE" });
  });
});
