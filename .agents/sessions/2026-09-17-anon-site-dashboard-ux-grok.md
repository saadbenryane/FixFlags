# Anonymous Site dashboard UX

Owner (Saad) tested a logged-out Site board: no Sign in, leftover left-rail watch/All Sites chrome, and brand buttons that had drifted to ink-on-orange.

## Change

- `SiteChromeAuth` on the Site board and Flag page: Sign in → `/sign-in?next=` current path.
- Left rail for logged-out visitors: Home · Flags · Settings only. Watch status, Keep watching, and All Sites stay signed-in.
- Restored `--brand-foreground` / `brandForeground` to white on bright Flag Orange.

## Checks

Focused SiteBoard + brand-contrast tests. Browser review of the local Site board after those pass.
