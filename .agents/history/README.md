# Agent coordination history

This directory preserves durable evidence, not live instructions.

- `legacy-board-2026-10-09.md` is the lossless migration snapshot of the former live board. It contains 245 parseable task records across its active and completed tables.
- `tasks/` contains one concise record per meaningful completed task created with `npm run agent -- task finish ... --summary ...`.
- Live ownership is stored outside tracked files under the Git common directory so every local worktree observes the same leases.

Do not route this directory into default agent context. Use it only for task provenance or an explicit handoff.
