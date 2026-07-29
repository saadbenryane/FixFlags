# Playwright web and worker runtimes need separate ports

## Finding

The isolated Playwright server started the production web runtime and worker
runtime under one shared `PORT`. `runtime-start.mjs` also used `PORT` for the
worker health server, so it competed with the web server. One process exited
and `concurrently -k` terminated the other, leaving browser tests with
`ERR_CONNECTION_REFUSED`.

## Prevention

- Keep `PORT` as the web runtime port.
- Set `WORKER_HEALTH_PORT` when web and worker run together in one verification
  environment.
- Let `runtime-start.mjs` fall back to `PORT` when the worker runs in its own
  container, preserving the deployed single-process contract.
- Use the production-like `npm run agent -- eval ui` path to catch startup
  failures before page assertions.

## Evidence

- Before the fix, all canonical sample tests failed to connect to
  `127.0.0.1:3107`.
- After assigning the worker health server port `3108`, the isolated UI
  evaluation started both runtimes and passed all five canonical sample tests.
