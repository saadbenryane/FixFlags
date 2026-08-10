# Learning: Customer Executive Upgrade (2026-08-10)

- **Date:** 2026-08-10
- **Scope:** Agent operating system (customer executive)
- **Confidence:** High
- **Evidence:** New canonical files created under `.agents/company/`:
  - `customer-exec-ops.md` (memory stack, worker personas, spawn contract, heartbeat packet)
  - `customer-weekly-heartbeat.md` (CEO-ready weekly template)
  - `customer-heartbeat-executor.md` (wake procedure, decision policy, budget discipline)
- **Discovery:** The customer executive previously had no canonical dispatch or reporting template. CEO delegation and weekly review therefore depended on ad-hoc chat memory.
- **Why it matters:** Worker contracts without all fields are not dispatched; a missing heartbeat template causes fabricated or skipped metrics. Canonical files make the loop repeatable and evidence-first.
- **Correct approach:** Always route worker dispatch through `.agents/company/customer-exec-ops.md`; heartbeat through the weekly template; verification through `npm run agent -- verify`.
- **Where prevention is encoded:** These three files, referenced from the company README. No competing parallel policy files.
