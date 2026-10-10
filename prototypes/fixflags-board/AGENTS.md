# Prototype instructions

- Run the local server and inspect the available preview when changing visible behavior.
- Build application UI in `src/`.
- Preserve `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` so the prototype remains portable to Sites.
- Before a Sites handoff, run `npm run build` and `npm run test:sites`. The build must produce `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

A supplied mock may guide layout and visual hierarchy. Do not copy its wording, data, or product claims unless the user explicitly makes those elements authoritative. Do not add durable instructions to this file unless the user asks to change the prototype's operating rules.
