# next/image localPatterns can blank production brand assets

## Finding

When `images.localPatterns` is set in `next.config.ts`, Next.js treats it as an **allowlist**. A screenshots-only list (`/api/screenshots/**`) made every `/_next/image?url=/brand/...` and `/marketing/...` request return HTTP 400 `"url parameter is not allowed"`, while the raw `/public` files still returned 200.

## Prevention

- Keep `/brand/**` and `/marketing/**` in `localPatterns` whenever that list exists.
- Serve pre-compressed brand/marketing assets with `unoptimized` so they do not depend on the optimizer.
- `npm run image:local-patterns-guard` fails if required pathnames are dropped.

## Evidence

- Live probe 2026-07-23: `/brand/logo-lockup-light.png` → 200; `/_next/image?url=%2Fbrand%2Flogo-lockup-light.png&w=256&q=75` → 400 body `"url parameter is not allowed"`.
- Introduced in commit `da733760` (screenshots-only localPatterns); brand/marketing patterns added later in `24f4da95` but production was still on the broken allowlist until this fix redeployed.
