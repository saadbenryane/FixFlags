# Docker npm ci + better-auth packaging (2026-07-19)

## What broke

Railway failed at `RUN npm ci --include=dev` after passkey landed: `@better-auth/passkey` / `better-call` optional peer `zod@^4` conflicted with app `zod@3`. Separately, `next build` failed because passkey imports `@better-auth/core/api` while core was nested under `better-auth/node_modules` only.

## Durable fix

1. Zod 4 at app root (aligns better-auth peers).
2. Direct dep `@better-auth/core` at the same version as `better-auth` / `@better-auth/passkey`.
3. `package.json` `overrides` pin those packages (and `better-call`).
4. LLM tool schemas: Zod 4 `z.toJSONSchema` via `lib/audit/zod-json-schema.ts` (`zod-to-json-schema` returns `{}` on Zod 4).
5. Do not add direct `better-call` (worsens peer resolution). Prefer no `legacy-peer-deps` once Zod is aligned.

## Deploy gate

CI does not run `docker build`. When touching `Dockerfile` / `package*.json` / `.npmrc`, run `npm ci` and `docker build -t fixflags:local .` before push. If `.npmrc` exists, COPY it before `npm ci` in the Dockerfile.

## Related product bug fixed same pass

`persistTriageResults` → `clearAuditResults` deleted all flags, wiping Pro journey findings. Clear only `DETERMINISTIC` + `AI`.