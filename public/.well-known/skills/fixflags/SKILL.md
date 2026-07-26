---
name: fixflags
description: Check a deployed product with FixFlags, validate its highest-ranked Flag, fix the product, deploy the change, and Re-check the original report. Use when finishing, auditing, or verifying an AI-built website or web application.
---

# FixFlags

Use the deployed product URL configured by the user. If none is configured, ask for it before starting.

1. Run `fixflags check <deployed-url> --wait --plan` or the MCP tool `ff_check_and_plan`.
2. Open the highest-ranked unresolved Flag. Confirm its page, viewport, evidence, and screenshot against the deployed product.
3. Fix the product code that caused the Flag. Do not weaken, suppress, or special-case the detector to make a valid Flag disappear.
4. Run the product's relevant tests. Deploy the verified change to the same URL.
5. Re-check the original report with `fixflags recheck <report-id> --wait --diff` or `ff_recheck_and_compare`. Never substitute a new unrelated check for this verification.
6. Report the original and Re-check report links plus the Fixed, Remaining, New, and Regressed Flag counts.

Treat FixFlags evidence as a lead that must be validated, not as permission to make an unsupported change. Do not expose FixFlags credentials in code, project files, command arguments, logs, or chat.
