# Anonymous empty-state filters must not hide stale evidence

## Finding

The anonymous Site board filtered starter cards by `state === 'unknown'` and zero open Flags. That shape described both a card FixFlags had never checked and a previously evidenced card whose eight-day freshness window had expired, so stale coverage disappeared entirely instead of becoming visibly out of date.

## Durable rule

Presentation filters must use the explicit evidence fact. Hide an anonymous starter card only when `evidenced` is false. If `evidenced` is true, retain the card, its original checked time, and the stale recovery answer even when the current state is `unknown`.

State answers whether evidence is currently healthy; `evidenced` answers whether FixFlags has ever earned the right to show the card. Do not infer one from the other.
