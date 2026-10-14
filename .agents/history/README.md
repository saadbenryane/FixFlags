# Agent coordination history

Retired boards, task records and design comparisons were removed from the checkout. Tracked historical evidence remains available in Git history.

`npm run agent -- task finish ... --summary ...` can create a scoped local receipt under `tasks/` when it is needed for a consequential handoff. Receipts are ignored by Git. Live ownership remains in the Git common directory so every local worktree observes the same leases.

Do not route this directory into default agent context. Use it only for task provenance or an explicit handoff.
