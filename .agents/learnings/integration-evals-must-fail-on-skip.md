# Required integration evaluations must fail when prerequisites are absent

## Finding

The recovery evaluator ran an isolated Redis exercise, then invoked the application-queue Vitest file without loading `.env.local`. Vitest skipped the suite because `REDIS_URL` was absent, returned exit code 0, and the evaluator printed that the application queue had passed.

## Prevention

- Evaluation entrypoints load their declared environment before spawning child checks.
- Required integration suites receive an explicit requirement flag.
- A missing prerequisite throws instead of converting required coverage into a skip.
- Completion output is printed only after the integration suite executes successfully.

## Evidence

- Before the fix, the recovery log showed one skipped test followed by “Recovery evaluation passed.”
- `npm run agent -- eval recovery` now runs two application-queue tests, including a stale mid-CAPTURING requeue, with zero skips.
