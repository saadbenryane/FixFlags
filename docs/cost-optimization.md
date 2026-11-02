---
status: supporting
authority: operations
reviewed_at: 2026-11-02
---

# Railway cost optimization

## Operator commands

`npm run sites:purge -- --preview --manifest <private-file> --email <owner> --keep-host <retained-host> --remove-host <host> --unlinked-host <host>` creates a database-bound manifest. Repeat host arguments to enumerate the exact scope. `--apply --manifest <private-file>` revalidates ownership and inventory, fences execution, erases captures, and deletes one report per transaction. It resumes from `<private-file>.progress.json`. The command never loads a local environment file. Supply the intended `DATABASE_URL` explicitly.

Keep both private files outside version control. They contain identifiers, not report content, and are needed to reapply erasure after an older backup is restored. Preserve the retained site's reports and all other tenants. Existing backup retention remains separate from deletion in the active database.

Before applying, measure free storage in the actual database container, inspect WAL usage and `max_wal_size`, and reserve room for deletion and checkpoints. Root-report cascades can write substantial WAL even in small report batches. Checkpoint mode defaults to every five reports and refuses a WAL budget above 256 MB. Setting `--checkpoint-every 0` is an explicit operator override, not the production default. A completed checkpoint may need subsequent cycles to retire previously preallocated WAL segments. Never delete WAL files directly.

`npm run validation:session -- --service Validation-Web -- <verification-command>` starts only the requested public-validation services and their referenced validation dependencies, waits for startup, runs the command, and stops the services in reverse order on success, failure, or ordinary interruption. It refuses production dependencies and services already owned by another session. This wrapper does not authorize browser tests; those still require an explicit request. Verify cleanup after an abrupt host or process failure.

## Runtime budgets

The worker's PageSpeed cache is bounded by 500 entries and 16 MiB of serialized values, rejects oversized entries, and expires unread entries. `npm run cost:profile-cache` compares the committed predecessor with the current cache using synthetic payloads and post-GC heap measurements. Serialized bytes, JavaScript heap, process RSS, and container memory are separate measurements.

Prisma pools use at most five web connections or ten worker connections, retaining a smaller explicit limit. The default pool timeout is ten seconds. Credentials and private hostnames are preserved. Worker memory logs contain fixed numeric fields, active-task counts and browser-context counts, without website content or credentials.

## Deployment and rollback

The cost runtime branch is based on the deployed `aa90044dbb306b09ae28309950db45738a9bdcff`, preserving unrelated checkout changes. Deploy that isolated candidate, not the dirty primary worktree. Keep the deployed image digest and source commit with the operator receipt. Pool and cache changes can be rolled back to the preceding deployment; erasure cannot.

The November 2 cleanup interrupted once when WAL exhausted the 5 GB database volume. PostgreSQL recovered automatically. WAL was changed from 1024/80 MB maximum/minimum to 128/32 MB, then the purge resumed with checkpoints. Ordinary vacuum/analyze completed. Approximately 510 MiB was free afterward. Existing release backups on that volume were preserved. Do not treat reusable database space as an immediate reduction in provisioned volume size.

Public-validation services have no Git deployment triggers and are parked between validation sessions. Their volumes and deployment definitions are retained. Extra Redis services remain stopped because absence of production references alone does not prove their queues can be discarded.

The previous billing period used $80.41, including $69.01 of RAM. Validation shutdown is estimated to save about $10/month. Madouane had five replicas with two analysis slots each. Consolidating to two replicas with five slots retains ten total slots and is estimated to save about $12/month of idle RAM. These are estimates until provider usage settles.

Observe normal activity for 72 hours. Compare equivalent retained-site checks, memory after completed work, errors, pool waits, and queue latency. Revert runtime or pool changes if comparable execution time or queue latency worsens by more than 10 percent. When traffic is insufficient, record the evidence gap instead of declaring performance acceptance. Keep the $80 soft usage alert and no hard shutdown limit.
