# Task coordination compatibility pointer

Live ownership uses Git-common-dir task leases, shared by every local worktree without creating merge conflicts.

Use these commands instead of editing this file:

```bash
npm run agent -- ownership
npm run agent -- task claim <task-id> --owner <name> --scope "<scope>" --path <related-path>
npm run agent -- task heartbeat <task-id> --owner <name>
npm run agent -- task finish <task-id> --owner <name> --summary "<outcome>" --evidence "<receipt>"
npm run agent -- task release <task-id> --owner <name>
```

Claims last 24 hours. Expired claims warn but are not reassigned automatically. Reclaim with `--reclaim "<reason>"`. Path or scope overlaps warn without discarding either claim.

Historical records are preserved in:

- [Legacy board snapshot](history/legacy-board-2026-10-09.md)
- [Older board archive](BOARD-archive.md)
- [Durable completed task records](history/tasks/README.md)

Do not load those histories for ordinary orientation or ownership checks.
