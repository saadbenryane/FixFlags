# Queue and capture presentation must be terminal-state aware

- Date: 2026-07-26
- Evidence: `lib/queue/estimate.ts`, `lib/audit/screenshot-types.ts`, and the real local report `cms1obwge0001grbrc4bn34ev`.

An enqueue estimate must begin with live worker capacity. A nonzero minimum wait makes an idle worker look backlogged, while counting every delayed job treats future scheduled work as if it were already ahead of an immediate check. Zero active/waiting work on a ready worker must return `queued: false`, zero jobs ahead, and zero estimated start seconds.

Screenshot warnings are terminal presentation states, not absence checks. Missing rows during `QUEUED` or `CAPTURING` mean `pending`. Only an explicit post-capture device failure may become `partial` or `unavailable`.

Prevent recurrence with queue-capacity unit tests, an additive structured queue response, and an exhaustive capture-presentation state test.
