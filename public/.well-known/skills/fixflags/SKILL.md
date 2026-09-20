---
name: fixflags
description: Use FixFlags to analyze a deployed website, validate an evidence-backed Flag, fix it, verify the live behavior, and leave the Site watched. Use when finishing, auditing, or verifying a website or web application.
---

# FixFlags

FixFlags looks after a website and the customer journeys the business depends on. The customer model is **Site → Cards → Checks / Journeys → Flags → Fix → Verify → Watch**. Shopify and future connections enrich the same Site.

Use the web product at `https://fixflags.com`. CLI, MCP, API keys, repository scanning, Product Review, Finish Plan, and the report Agent are not current customer entry points.

## Workflow

1. **Analyze the deployed URL.** Submit the real public website. Do not substitute localhost, source inspection, or a static screenshot for live browser evidence.
2. **Open the Site.** Confirm coverage and freshness before interpreting health. No Flags does not mean untested behavior is healthy.
3. **Choose a Flag.** Prefer the highest-ranked customer-relevant Flag. Validate its page, journey, viewport, screenshot, and textual evidence against the live site before changing code.
4. **Fix.** Apply the smallest coherent product change. Copying or sending a Flag to a coding AI records a handoff, not completion.
5. **Deploy to the same URL.** Run the product's own checks before deployment.
6. **Verify the affected behavior.** Start Verify from the original Flag. Verification must freshly exercise the relevant success state. The old symptom merely disappearing is not proof.
7. **Report the result.** Distinguish Verified, Still flagged, Regressed, and Inconclusive. Include the Site and Flag links when available.
8. **Keep Watch honest.** Confirm the displayed cadence and readiness. Do not claim continuous, hourly, or all-clear coverage unless the Site shows it.

## Evidence and safety

- Treat every Flag as a grounded lead, not permission for an unsupported change.
- Preserve tenant boundaries. A public evidence link never authorizes access to private Site, connection, history, or support data.
- Do not expose credentials in code, files, logs, URLs, or chat.
- Do not weaken a detector or special-case a site merely to remove a Flag.
- If a connection is unavailable or revoked, core browser analysis should remain usable and the product should explain the limitation without exposing provider configuration.

## Output

Summarize:

- the Site and journey checked;
- the Flag and evidence validated;
- the fix deployed;
- the fresh verification result;
- remaining Flags, regressions, or incomplete coverage;
- Watch status and any action the customer still needs to take.
