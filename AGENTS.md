# Project conventions

## Git workflow

**Always work on `main`.** This is a solo development setup — there is no need for
feature branches, and we keep only one branch (`main`) locally and on the remote.

During development, push work **directly to `origin/main`** so it deploys to the live
environment for testing. Do **not** create feature branches or open pull requests unless
explicitly asked. Production (Railway) deploys from `main`, so anything that needs to be
tested on the deployed app must land on `main`.

## Landing page

Homepage section order (canonical):

1. Hero (stable headline/subhead; one interactive report preview)
2. Logo cloud (compact bridge below hero report)
3. Three dimensions (Message, Experience, Reach — checklists + example findings)
4. Fix loop (scan → flag → fix → verify cards with arrows)
5. Example feedback (honest disclaimer; no unverifiable counts)
6. Final CTA (URL input repeated; outcome-led copy from `FINAL_CTA`)

Rules:

- Do not duplicate the report explorer below the hero
- No How-to-Start toggle, no evidence screenshots section
- Hero copy changes only when explicitly requested
- Marketing strings live in `lib/marketing/copy.ts`; guardrails in `lib/__tests__/homepage-message.test.ts`
- Social proof must match `LANDING_PAGE.testimonials` disclaimer; never invent member counts
- Avoid banned marketing phrases: "second pass", "flag it" (as punchline), "Ship tonight", "Fix my live site", "Start in 60 seconds"

## Changelog

The public changelog (`lib/marketing/copy.ts` → `CHANGELOG_ENTRIES`) is for **users**, not internal notes.

### Do
- Say what the user gets ("Sign up and create your account to start testing")
- Announce betas, new features, and improvements in plain language
- Invite feedback ("We'd love your feedback — use the chat button")
- Describe outcomes and benefits

### Don't
- Explain how something was built or mention implementation details
- Use internal terminology or backend concepts
- List technical changes (e.g. "Trust checks run as scan modules" or "Updated MCP tools")
