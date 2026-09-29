# A Server Component that calls a client hook only fails at build time

Discovery: 2026-09-29, repairing the deploy blocked by my own `89ed9cdb`.

## What happened

`89ed9cdb` added the Flags Resolved tab. `components/sites/SiteFlagsView.tsx` called `useSearchParams()` to read `?tab=`, and its parent `app/sites/[siteId]/flags/page.tsx` is a Server Component. That combination does not compile:

```
You're importing a component that needs `useSearchParams`.
This React Hook only works in a Client Component.
```

Everything green said the change was safe. 463 files, 5,621 tests, `tsc --noEmit` clean, `eslint --max-warnings=0` clean, `npm run verify` green. None of them can see a server/client boundary, because the boundary does not exist in jsdom: React Testing Library renders a component, and a component that calls `useSearchParams` renders perfectly well in a test. `next build` is the only thing that knows.

The consequence was worse than a broken page. `main` did not build, so **nothing after `89ed9cdb` could be deployed at all**, and the board carried the change as shipped.

## The tell that the design was wrong, not just the directive

The sibling `components/sites/SiteSettingsView.tsx` is the same shape: a Server Component that renders a client child (`SiteSettingsControls`) for the interactive part. `SiteFlagsView` had no interactive part at all. Its two tabs are plain `Link`s, which work fine in a Server Component. So the hook was never needed; it was reached for because it is the first thing you reach for when you want a query parameter in Next.js, and nothing in a unit test objects.

The repair is the one the sibling already models: read `searchParams` in the server page, validate it against the two real tabs, pass the result as a prop.

## Prevention encoded

- `components/sites/__tests__/SiteFlagsView.test.tsx` reads the source and asserts `SiteFlagsView` never calls `useSearchParams` and is not marked `'use client'`, with the same assertion on `SiteSettingsView` so the pair cannot drift. Comments are stripped before matching, so the file can explain the boundary without defeating the guard.
- `siteFlagTab` is a pure function with its own tests: the two real tabs pass, and a missing, repeated, mis-cased or unknown value returns `open`. A mangled URL must show the Flags that need a fix, never a blank page.
- The rest of the file renders both tabs and asserts the two lists never bleed into each other, and that an empty open list does not read as healthy.

## Walking the path that unit tests cannot

`npm run build` had to pass, and then the real page had to be walked. Signed in through the actual `POST /api/auth/sign-in/email` route with the seeded local admin, because the session cookie is signed and minting a `Session` row by hand is rejected. `Origin` must be `NEXT_PUBLIC_APP_URL`; any other value answers 403 `INVALID_ORIGIN`.

With a real session against the local `example.net` Site, all four of `/flags`, `?tab=open`, `?tab=resolved` and `?tab=bogus` returned 200, and the HTML proved the tab actually changed: Open attention selected on the first three, Resolved selected on the third, and the two sections never rendered together. The Resolved tab was empty because no local Flag was FIXED, so I set one `status: 'FIXED'` with `resolvedInId` pointing at a real COMPLETED audit, confirmed the Resolved tab then showed that Flag and not an open one, and confirmed the Flag page said "verified as fixed by an independent check on <date> ... Proof audit: <id>" with Fix and Verify hidden. The fixture was reverted afterwards and the walk scripts deleted.

## How to find this class of gap again

`npm run build` is the only check that knows about the server/client boundary, so it belongs in the definition of done for any change that adds a hook to a component, not only for `npm run verify`. When a UI change is "obviously just reading a query param", that is precisely when to build.

And the wider lesson: an agent board can hold several rows marked `review` describing local verification that never included a build. Green tests plus a clean typecheck plus a clean lint is three views of the same non-question. Ask what check would catch the failure the change could actually cause, then run that one.
