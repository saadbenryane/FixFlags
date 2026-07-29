# Launch readiness — Phase 4

## Product Hunt copy draft

**Headline**: FixFlags — independent finish check for AI-built products

**Tagline**: Paste your URL. Get ranked fixes with evidence across Message, Experience, and Reach. Copy a fix prompt into your editor and prove the change with a free re-check.

**First comment**:

We built FixFlags because AI editors ship fast but miss what a human reviewer catches: unclear messaging, CTAs below the fold, missing social previews — the details that make a product feel finished.

Three rubrics, one report:
- Message → does the page communicate value in 5 seconds?
- Experience → can people complete the important journey?
- Reach → does the product show up when shared or searched?

Every flag includes evidence (screenshots, viewport, page location) and a fix prompt you can paste into Cursor, Claude Code, Lovable, Bolt, or any AI editor. Re-check is free after you ship.

Try it on your URL: https://fixflags.com
See a sample: https://fixflags.com/samples
Connect via MCP: https://fixflags.com/help/mcp

## 30-second demo video script

1. Open fixflags.com (2s)
2. Paste a URL (3s)
3. See scan progress (5s)
4. Report loads — three rubric summary (5s)
5. Click top flag → see evidence screenshot (5s)
6. Copy fix prompt (3s)
7. Click Re-check (2s)
8. See diff — "Critical: 2 → 0" (5s)
End screen: fixflags.com

No voiceover. On-screen caption: "Paste URL. Get fixes. Re-check."

## Support + incident protocol

**Where support arrives**:
- In-app chat (via HelpCenter)
- PH comments during launch week
- Direct DMs from outreach list

**Who responds**: You (founder) during launch week. Escalate to yourself.

**P0 criteria** (fix same day, communicate publicly):
- Scan fails for ALL users (infra down)
- Report loads with blank/empty evidence
- Re-check never completes (infinite loop)
- Fix prompt clipboard leaks gate text

**P0 response**:
1. Acknowledge in PH thread within 2 hours
2. Fix or rollback within 24 hours
3. Re-scan affected reports
4. Post update in thread

**Non-P0** (fix in weekly rhythm):
- Single-site scan failure
- Weak evidence on one flag
- Slow scan (>5 min)
- False positive on edge case

**Communication**:
- Bad news in the PH thread, not hidden in DMs
- Honest about what broke and what was done
- Offer re-checks to affected users

## What needs your manual action

1. Record the 30s demo video (screen capture, no voiceover)
2. Post to Product Hunt with the draft above
3. Contact 10-15 builders personally before PH
4. Monitor scan completions + errors in real time during launch
5. Reply to every PH comment

## Verified deployment state

- Production health: ✅ `fixflags.com/api/health` returns ok
- Storage (R2): configured
- AI (OpenAI): configured
- Billing (Stripe): configured
- Worker: configured
- Pipeline version: 2.4.0
- Homepage: 5 sections (Hero → Sample → Integrations → Final CTA)
- Funnel analytics: 31/36 events firing
- Anonymous wedge: verified — evidence visible, 1 fix demonstrated, clipboard safe
- E2E tests: public + credentialed journeys pass
