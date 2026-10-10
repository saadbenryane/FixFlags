# Agent harness benchmark

Measure the instruction harness, not the model. Run the same six repository tasks once under `baseline` and once under `candidate`, using GPT-6.1 Sol, Medium reasoning, and Standard speed for both conditions. Repeat only a failed or anomalous task as a separately documented investigation.

Record aggregate measurements only: duration, tool turns, success, sources opened, corrections, policy violations, and exported usage. Never record prompts, responses, source code, transcripts, or secrets. Use `null` when usage or credits are unavailable; never estimate them.

- `npm run agent:benchmark -- tasks`
- `npm run agent:benchmark -- record result.json`
- `npm run agent:benchmark -- report`

The local `runs.jsonl` file is ignored by Git. The report remains `insufficient-telemetry` until all twelve baseline/candidate runs exist. A candidate passes only when success does not regress, policy violations are zero, and median input/output tokens or tool turns improve by at least 20 percent.
