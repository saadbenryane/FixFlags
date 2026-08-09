# Paperclip.ing waitlist → GitHub stars funnel teardown

**Date:** 2026-08-08
**Confidence:** HIGH (verified against live site source, client JS bundle, Wayback snapshot 20260306080717, GitHub API)
**Scope:** Competitive research. No FixFlags changes made.

## The conversion mechanic (current, July 2026)

1. Hero primary CTA "Join the waitlist" (`#waitlist`); secondary link "or install the local version" (`#get-started`) — waitlist creates scarcity for cloud, self-host path always open.
2. Modal: email + audience ("Just me / A few teammates / A whole team / My clients") + delegated work types (7 checkboxes incl. "Not sure yet"). POST `/api/waitlist/` with `{email, audience, delegatedWorkTypes, delegatedWorkOther}`.
3. On success the modal transitions to a **star-prompt state** (not a thanks screen): title "Star Paperclip on GitHub", copy "Help more people discover Paperclip while we get your invite ready.", GitHub button with **live star count** (fetched from `api.github.com/repos/paperclipai/paperclip`, fallback "75k+"), and a quiet "Skip" button.
4. Success state: "You've been added to the waitlist. We'll email [email] as soon as your invite is ready."

Psychology: email first (commitment makes the next ask cheap), star framed as a favor + something to do while the invite is prepared (reciprocity, not ransom), social proof inside the button, visible Skip preserves goodwill.

Launch-era site (2026-03-06) was star-first with no waitlist: navbar CTA was a "Star" button, quickstart had "Star on GitHub" primary + "Read the docs →", terminal `npx paperclipai onboard --yes` with copy button, "No Paperclip account required." Result: 20k stars in week one, 75.9k in ~5 months (repo created 2026-03-02, MIT).

## Design system notes

- Fonts: Inter + Inter Tight (variable), JetBrains Mono (eyebrows/code); launch era added Instrument Serif italic accents.
- Palette (dark default, `--background:#0a0a0a`, `--foreground:#fafafa`): paper-metaphor tokens — `--bond`, `--ink`, `--charcoal`, `--graphite`, `--aluminum`, `--parchment`, `--manila`, `--cream`. Announcement bar is manila/ink.
- Signature hero: vertical columns of capsule rects (70×170, rx=35) with violet→orange→magenta gradient sweeps + feTurbulence dither texture + CSS-animated column offsets.
- Composition: announcement bar (release version + changelog link, cadence proof), one primary CTA per section, mono uppercase pill badges, numbered steps 01/02/03, staggered card reveal (80ms), two-column deep dives with **live product UI mockups** (org chart, heartbeat schedules, budget bars, ticket traces, approval cards), brand-agnostic monochrome logo wall, real named testimonials with handles, terminal block with copy button.
- Motion: `cubic-bezier(.2,.8,.2,1)`, 150/250/400ms durations; modal with backdrop blur + rise animation + focus management.

## Growth layer

- `llms.txt`, `.well-known/api-catalog`, `.well-known/agent-skills/index.json` — LLM-agent discoverability; install docs tell agents to read `llms.txt`.
- Live star-count widget in CTA buttons; dated changelog pages; Discord/X/LinkedIn; open-source page terminal CTA "Star it on GitHub →".

## Applicable ideas for FixFlags

1. Sequential ask: capture claim/email first, then ask for the star post-value ("while your report finalizes") with live count + Skip.
2. Reciprocity framing, never a gate; visible escape hatch.
3. Scarcity path + always-open self-serve path in parallel (FixFlags teaser/claim/Finish Plan vs public CLI already mirrors this).
4. Live product UI mockups over static screenshots in evidence sections.
5. Dated release + changelog as cadence proof.
6. `llms.txt` + `.well-known` if agent discoverability matters.

## Sources

- https://paperclip.ing/ (raw HTML + client chunk `1k7fvfjilcbyo.js` — waitlist modal + star-prompt state)
- http://web.archive.org/web/20260306080717/https://paperclip.ing/ (launch-era star-first funnel)
- https://api.github.com/repos/paperclipai/paperclip (75,875 stars, MIT, created 2026-03-02)
- https://paperclip.ing/llms.txt, /product/open-source/
