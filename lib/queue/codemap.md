# lib/queue/ - BullMQ Queue

## Responsibility
Async job queue for audit processing. Manages job enqueue, worker processing, heartbeat monitoring, stuck-audit recovery, and Redis connection.

## Entry Points
| File | Purpose |
|------|---------|
| `client.ts` | Enqueue audit jobs (`enqueueAuditJob()`) |
| `worker.ts` | BullMQ processor used only by the dedicated worker runtime |
| `redis.ts` | Redis connection (ioredis client) |
| `recovery-scheduler.ts` | Self-hosted scheduler for stuck-audit recovery |
| `lock.ts` | Distributed lock (prevents duplicate processing) |
| `worker-heartbeat.ts` | Worker health reporting |
| `estimate.ts` | Queue depth / wait time estimation |

## Architecture
- **Web role:** Enqueues jobs and serves report/status reads; never owns Playwright
- **Worker role:** Exactly one worker runtime per process consumes the Redis queue
- **Concurrency:** Defaults to one locally and is explicitly configured per production worker
- **Scheduler:** Self-hosted via `recovery-scheduler.ts` (no external cron)
- **Lock:** Redis-based distributed lock prevents duplicate job processing

## Integration Points
- **Audit pipeline:** `lib/audit/create-audit.ts` enqueues jobs
- **Worker:** Processes jobs via `lib/audit/runner.ts`
- **Recovery:** `lib/audit/stuck-audit-recovery.ts` detects stalled audits
- **Redis:** Shared connection for queue + lock + heartbeat

## Invariants
- All jobs have unique `auditId` (prevents duplicates)
- Worker heartbeats are per process and include browser/context diagnostics
- A lost job after capture starts becomes terminal instead of silently replaying
- Recovery scheduler runs every 60s
