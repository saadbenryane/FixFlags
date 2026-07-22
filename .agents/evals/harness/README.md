# Agent harness benchmark

Eight repository tasks are measured under `baseline` and `axi` conditions with three fresh sessions each. Keep model, harness, prompt hash, and fixture hash identical.

Record actual duration, tool turns, success, and exported input/output tokens. Use `null` when token telemetry is unavailable; never estimate it.

- `npm run agent:benchmark -- tasks`
- `npm run agent:benchmark -- record result.json`
- `npm run agent:benchmark -- report`

The report remains `insufficient-telemetry` until all 48 runs exist.
