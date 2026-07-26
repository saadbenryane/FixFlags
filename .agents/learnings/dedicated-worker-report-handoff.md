# Dedicated worker and lightweight report handoff

Validated 2026-07-26 against `saadbenryane.com`.

- Running Playwright inside `next dev` blocks report compilation and lets hot
  reload create multiple browser owners. The web process must only enqueue and
  read reports; `worker/index.ts` owns the browser and BullMQ consumer.
- Do not hot-reload the default worker. `npm run dev` uses a stable standalone
  process; `worker:watch` is only for focused work with no active scan.
- The create handoff must not mount a full progressive report over the complete
  homepage. A small portal plus document navigation committed reliably; the
  full progressive model belongs on `/report/[id]`.
- Unfinished report rendering must use `progressiveAuditSelect`. The completed
  graph, Finish List, comparisons, project, journey, and technology enrichment
  load only after `COMPLETED`.
- `FINALIZING` is not terminal. Poll recovery and health overdue checks must
  enforce the same 180-second audit deadline for every active stage.

Measured local evidence:

- Create request: 720 ms on the warmed development server.
- Progressive report commit: under one second after route warm-up.
- Homepage/status under an active scan: 388 ms / 42 ms.
- Full real scan: 155 seconds, `COMPLETED`, no stage restart.
- Responsive progressive report: no horizontal overflow at 320, 375, 768, or
  1280 px.
