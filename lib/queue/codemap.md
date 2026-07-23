# lib/queue/ - BullMQ Queue

## Responsibility
Async job queue for audit processing. Manages job enqueue, worker processing, heartbeat monitoring, stuck-audit recovery, and Redis connection.

## Entry Points
| File | Purpose |
|------|---------|
| `client.ts` | Enqueue audit jobs (`enqueueAuditJob()`) |
| `inline-worker.ts` | Inline worker (runs in Next.js process, default mode) |
| `worker.ts` | Standalone worker (separate process, production scaling) |
| `redis.ts` | Redis connection (ioredis client) |
| `recovery-scheduler.ts` | Self-hosted scheduler for stuck-audit recovery |
| `lock.ts` | Distributed lock (prevents duplicate processing) |
| `worker-heartbeat.ts` | Worker health reporting |
| `estimate.ts` | Queue depth / wait time estimation |

## Architecture
- **Default mode:** Inline worker (`INLINE_WORKER=true`) runs in Next.js process
- **Scaled mode:** Separate worker process(es) consume same Redis queue
- **Scheduler:** Self-hosted via `recovery-scheduler.ts` (no external cron)
- **Lock:** Redis-based distributed lock prevents duplicate job processing

## Integration Points
- **Audit pipeline:** `lib/audit/create-audit.ts` enqueues jobs
- **Worker:** Processes jobs via `lib/audit/runner.ts`
- **Recovery:** `lib/audit/stuck-audit-recovery.ts` detects stalled audits
- **Redis:** Shared connection for queue + lock + heartbeat

## Invariants
- All jobs have unique `auditId` (prevents duplicates)
- Worker heartbeat updates every 30s
- Stuck audit threshold: 10 minutes without heartbeat
- Recovery scheduler runs every 60s
