# Analyze entry skip target

Date: 2026-09-29. Owner: codex-01a0ec19. Scope: `new-entry-skip-target-2026-09-29`.

## Customer problem

The root layout offers a "Skip to content" link to `#main-content`, but the released `/new` Analyze page had no matching ID and no main landmark. In production Chromium at 375 px, the first Tab focused that link and Enter changed the hash while leaving focus on the link. This blocks a keyboard visitor's direct jump to the URL form on the first-value route. The page itself returned HTTP 200, had no horizontal overflow or page errors, and its empty/invalid URL messages worked.

## Change

`app/new/page.tsx` now wraps its existing section and `AuditInput` in one focusable `<main id="main-content">`. The unchanged descriptive sentence moved into `REVIEW_ENTRY.description` in canonical copy. The design-system skill now names the global skip-target contract for standalone entry routes. No scan, identity, or billing behavior changed.

## Evidence and limits

- Local Next dev on isolated port 4240 and output directory: Chromium at 375 and 1280 px, reduced motion, returned HTTP 200, one main landmark, first Tab on Skip to content, Enter moved focus to `MAIN#main-content`, and an empty Analyze submission still showed `Enter a URL like https://yoursite.com`. Both sizes had no horizontal overflow or browser page errors.
- Scoped ESLint, copy drift, UI drift and knowledge duplication guards passed. `npm run agent -- verify --dry-run` selected 30 commands because another owner's validation configuration is in the shared tree. Full type/build gates await the in-progress Wave 1 tree; no production release is claimed.
- The isolated Next process stopped, its generated cache was removed, and its automatic `tsconfig.json` change was restored. Other agents' working files were preserved.

Next: run required shared gates when the tree settles, release under existing authority, and confirm the keyboard jump on the deployed SHA.
