# Communication format must follow user-requested human-readable, emoji-scannable updates

**Date:** 2026-08-09
**Scope:** CEO heartbeat / status updates (FixFlags)
**Confidence:** HIGH
**Evidence:** User explicitly requested "explain like a human" with emoji list formatting; user followed up that I had not changed behavior and asked for self-update.

## Discovery

I initially responded with concise plain bullet points but did not persist and consistently apply the requested emoji-scannable style for status updates, even after explicit feedback to use that format.

## Why it matters

The project requires fast executive readability; inconsistent reporting format reduced signal quality and made it harder to consume weekly heartbeat updates quickly, increasing user cognitive load.

## Correct approach

For recurring status outputs, use a compact, scan-first structure with emoji sections:

- ✅ Done
- 🚧 In progress / active
- ⚠️ Blockers / risks
- ▶️ Next action + single owner

Keep language plain-English and explicit.

## Where prevention was encoded

- Added this learning entry for persistent reference.
- Future responses in this thread/session will follow the above structure automatically.
- Consider adding a brief status style check in task-session docs if this pattern becomes recurring.