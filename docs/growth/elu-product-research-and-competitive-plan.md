---
status: supporting
authority: product
reviewed_at: 2026-11-10
supersedes: []
---

# Elu product research and FixFlags competitive plan

The consolidated, phased plan that sequences this work is the [FixFlags master plan](fixflags-master-plan.md).

FixFlags should compete on useful problems found and independently verified repairs delivered with very little customer effort. Add a bounded code-repair execution layer to the existing Site and Flag lifecycle. Keep URL-first public-page checking as the initial experience, then offer an optional repository connection for supported repairs. A stronger website should demonstrate that working product loop.

This is product research and a proposed delivery sequence requested by the owner on November 10, 2026. The [website design plan](website-design-plan.md) is a separate workstream. The [completion plan](../product-masterplan.md) remains the execution authority for the current product; this research does not open parked repository execution, MCP discovery, paid access, automatic merging, or deployment. The owner's request to investigate code repair makes those capabilities valid subjects for a product decision.

## The competitive problem

Elu combines a valuable outcome, a developer entry point, a repair story, commercial qualification and visible trust signals. FixFlags needs a similarly complete offer. An owner who must understand a report, assemble context, open another tool, supervise the repair, deploy it and remember to verify it still carries substantial work.

The existing independent-monitor direction gives FixFlags a coherent foundation. Independence is a responsibility boundary: a repair executor can propose code while a separate verifier controls the evidence, acceptance conditions and recovery conclusion. Adding repair execution does not require allowing the code writer to certify its own result.

The central product question is whether FixFlags can repeatedly remove a meaningful live failure with less owner effort and trustworthy evidence. A broader feature inventory, a polished demonstration and passing internal suites cannot answer that question alone.

## What the public evidence establishes about Elu

Observed November 10, 2026. Public pages, legal descriptions, investor material and a published package establish different kinds of evidence. They do not establish authenticated output quality or customer outcomes.

| Dimension | Evidence | Competitive implication |
| --- | --- | --- |
| Discovery | Elu markets analysis of real-user behavior, bugs and friction. Its terms describe analytics/replay ingestion and connected sources. [Homepage](https://elu.dev/) and [service description](https://elu.dev/terms-service) | Behavioral observation can expose patterns synthetic checking cannot infer from a single run. |
| Developer onboarding | The published CLI installs a website tag and configures AI clients. Session replay is enabled by default. [Versioned package](https://registry.npmjs.org/@elu-labs/cli/-/cli-1.1.0.tgz) | One guided command reduces a multi-part setup to an approachable action. |
| Repair | The terms describe requested repository changes or pull requests, with customers responsible for merging and deployment. [Terms section 6.3](https://elu.dev/terms-service) | A useful code proposal is a practical competitive bar. |
| Autonomy | The investor profile describes code writing, review, simulated-user verification and merging. This differs from the terms' statement, “We do not merge code on your behalf.” [Investor profile](https://speedrun.a16z.com/companies/elu) and [terms](https://elu.dev/terms-service) | The availability and conditions of autonomous merging remain unresolved. Do not equate the headline with observed behavior. |
| Funding | The investor's own site lists Elu in cohort 007. [a16z speedrun](https://speedrun.a16z.com/companies/elu) | The backing signal has a primary source. Exact capital received and runway were not established. |
| Security presentation | The homepage displays AICPA SOC and GDPR graphics and describes masking and deployment choices. It does not identify a SOC 2 report type, period or auditor on that surface. [Homepage](https://elu.dev/) | Strong trust presentation is commercially relevant; a graphic alone cannot substantiate a specific audit claim. |
| Testimonials | Named quotes appear on the homepage; the demo route also presents video testimonial controls. [Homepage](https://elu.dev/) and [demo](https://elu.dev/onboarding/demo?from=landing) | These are vendor-published proof signals. Authenticity and attributed business effects were not independently established. There is no basis here to call them fabricated. |
| Commercial flow | Signup asks for a company email. Demo booking first asks a revenue range. Concrete paid prices were not established from the inspected entry and terms surfaces. [Signup](https://elu.dev/start), [demo](https://elu.dev/onboarding/demo?from=landing), [terms](https://elu.dev/terms-service) | Elu combines self-service entry with qualification for sales assistance. Do not infer its prices or economics. |
| Data relationship | The privacy policy describes connected product and repository data, third-party AI processing, and agreement-dependent model improvement with an email opt-out. [Privacy policy](https://elu.dev/privacy-policy) | Data scope, training choices and deletion behavior are product decisions that customers should understand. |

The public CLI is evidence of distributed onboarding software, not proof that every advertised backend capability works. The signed-in product, generated patches, deployment behavior, actual customer outcomes and report availability remain untested in this pass. No account was created, tracking installed, repository connected, or competitor command executed.

## Published CLI inspection

Version 1.1.0 was published on October 26, 2026. Its README describes framework detection, an approval step, browser/device sign-in, app-tag insertion and user-level MCP configuration for Claude Code, Cursor and VS Code. It also describes backup/undo behavior, restricted key-file permissions, monorepo selection, proxy support and noninteractive operation. This demonstrates care for real developer setup conditions. [npm metadata](https://registry.npmjs.org/@elu-labs%2fcli/1.1.0)

The package was downloaded for static inspection and its npm SHA-512 integrity value matched. The tarball SHA-256 was `2f6cfe803ecf57e47e801ee8f316cf077bee98ecaa8ea22e63e53ac7b8288133`. Competitor source was not added to this repository.

FixFlags should learn from that completeness. Its agent entry should eventually handle permission selection, restart/reconnection, actual connection verification, revocation and a clear next action. A copied configuration snippet alone leaves integration work with the owner.

## Where FixFlags has an advantage and where it has a gap

| Job | Existing foundation | Practical gap or boundary |
| --- | --- | --- |
| Start checking | Public URL entry and public-page execution | No installation is needed for public-page analysis. Authenticated, blocked and unsupported flows need explicit qualification. Repository repair necessarily needs separate permission. |
| Find a meaningful failure | Native HTTP/browser collection, eight coverage areas, persistent Flags and supporting evidence | Complete native coverage and repeated public precision acceptance remain open. Breadth of registered checks does not establish reliable detection across sites. |
| Give an agent context | Source-bound repair definitions, complete evidence delivery, revision checks and attachment handling | Instructions still require someone or something to perform the code change. [Repair contract](../../lib/sites/repair-brief-contract.ts) and [brief construction](../../lib/sites/repair-brief.ts) |
| Work inside developer tools | Site/Outcome/Run/Flag MCP tools and key/device infrastructure exist | Customer discovery is explicitly disabled pending actual-client acceptance. [Discovery gate](../../lib/mcp/discoverability.ts) and [tools](../../lib/mcp/tools/sites.ts) |
| Propose code | Retained repository PR infrastructure exists | It is parked. The automatic patch policy only targets tracked environment files for exposed-secret findings. Other cases can create an empty-commit draft with instructions. This is not general bug repair, and removing a tracked file does not rotate a leaked secret. [PR runner](../../lib/repo-scan/fix-pr-runner.ts), [policy](../../lib/repo-scan/auto-patch-policy.ts), [patcher](../../lib/repo-scan/mechanical-patch.ts) |
| Establish recovery | Independent comparison, repair attempts and recurrence history | Controlled local owner-loop evidence exists. Actual public recipient use, provider effects and successive natural monitoring intervals remain separate acceptance. [Completion plan](../product-masterplan.md) |
| Explain trust | Documented tenant, evidence, secret and permission boundaries | Formal external penetration testing and a SOC 2 report are not established in the security inventory. Operational proof and credible customer references still need to be earned. [Security](../../SECURITY.md) |
| Learn about real-user friction | Synthetic execution and private Site history | A synthetic observer cannot establish population drop-off, confusion or revenue impact without appropriate behavioral data. Do not present it as equivalent to session intelligence. |

The durable advantage to pursue is the combination of immediate checking, low-effort repair and independently observed live recovery. Its uniqueness is a hypothesis, not an established market fact. The [existing competitive briefing](competitive-and-conversion-briefing.md) already records why MCP availability alone is not unique.

## Product recommendation

Offer three connected ways to act on the same Flag:

1. **Use repair instructions.** Keep the current workflow for owners using builders or their own coding tools, and for unsupported repository cases.
2. **Use a connected coding tool.** Complete actual-client acceptance so an owner can ask an existing agent to retrieve the exact evidence, make a change and request independent verification without manually moving context.
3. **Have FixFlags prepare the code change.** Run an existing coding-agent harness inside a bounded environment, produce a real patch, validate it and return a reviewable pull request with preview evidence.

The third path is the recommended product addition. The second is a useful distribution and interoperability channel, but it does not remove the need to initiate and supervise an external agent. A hosted repair action should own that work for supported cases.

Initial segment: developers and small teams shipping public Next.js/React websites from GitHub, with a usable preview deployment. This is a deliberately bounded pilot, not a claim that the wider FixFlags audience must migrate stacks. Owners without source access retain useful monitoring and repair instructions.

Initial repair candidates: a broken primary first-party link with an established intended destination; a mobile layout defect blocking an important control; and a reproducible client-side interaction defect whose expected behavior is clear. Select the first family through actual detection quality and pilot availability. A cart-state repair can follow when the environment safely proves it without payment or real orders.

Classify every candidate before offering automation: code-repair eligible, configuration/provider action, needs product judgment, insufficient evidence, or unsupported. An ambiguous diagnosis must not become a confident patch merely because a model can edit a file. Product optimization requires agreed goals and experiments; defect recovery alone does not establish a conversion improvement.

## Repair architecture

Keep the existing Site, Flag, source-bound repair definition and repair-attempt history. Add execution artifacts to that lifecycle rather than requiring an unrelated repository scan to create a second finding for the same customer problem.

The proposed flow is:

```text
Observed Flag and frozen repair scope
  -> repair eligibility and owner permission
  -> exact Site, repository, base commit and deployment mapping
  -> isolated coding-agent execution
  -> real patch and focused regression checks
  -> independently checked preview
  -> reviewable pull request
  -> owner merge and existing deployment flow
  -> independently checked live target
  -> recovery evidence and continued monitoring
```

Important properties:

- Bind the attempt to the original evidence revision, supported expected behavior, exact source commit and authorized repository. Refuse stale or ambiguous mappings.
- Give the writer the repair brief and bounded repository context. Let a separate verifier own the acceptance procedure. Generated tests are useful evidence but cannot replace the original failure condition or silently weaken its assertion.
- Execute untrusted repository code outside the application and audit workers. Use clean disposable environments, bounded resources and network access, and explicitly scoped credentials. The existing Git helper inherits `process.env`; it must not become a general-purpose customer build sandbox. [Current clone helper](../../lib/repo-scan/clone.ts)
- Keep checkout/build execution away from GitHub write credentials. A separate publishing operation can create a branch and PR after authority and source revisions are rechecked.
- Start with one issue and one attempt budget, bounded retries, cancellation and durable resume. Report unsupported, blocked and failed repair attempts plainly. Do not create an empty PR and call it a prepared fix.
- Check the preview against a recorded failing baseline with comparable scope, access and device conditions. Guard against unrelated regressions in the affected journey.
- Record preview success, PR creation, merge, deployment and live recovery separately. A successful preview does not close the live Flag.
- Bind the deployment to the repaired commit and authorized Site. Recheck after the actual deployment settles. A rollback suggestion or revert proposal is distinct from a confirmed restoration.

Use a repository-selected GitHub App for new hosted repair access, with narrowly chosen permissions and short-lived installation credentials. The existing OAuth integration requests `repo`; an application allowlist does not narrow that upstream grant. GitHub documents the finer repository and permission control offered by Apps. [GitHub App comparison](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/deciding-when-to-build-a-github-app) and [permission guidance](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app)

## Build and buy boundary

Build the proprietary pieces: failure reproduction, eligible repair selection, exact evidence and source mapping, independent acceptance, durable attempt history, recurrence handling and a simple owner experience.

Use an existing coding-agent harness and disposable compute rather than creating a new general coding agent. An implementation spike should compare a harness operating in our isolated runtime with a managed runner against the same private repair cases. Score actual patch quality, cancellation, resumability, permissions, data handling and total execution cost.

Anthropic's Agent SDK is one documented candidate with file/command tools, sessions, permissions, hooks and usage tracking. Its documentation requires appropriate API authentication for third-party products rather than assuming access through a customer's consumer subscription. This establishes a viable integration surface, not a vendor selection or an estimate of repair success. [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)

Per-repair economics must include all failed attempts: inference, sandbox/build time, preview execution, independent verification, storage and provider costs. Track cost per attempted repair and per independently verified deployed repair, alongside owner intervention and retained uncertainty. Price only after measuring those quantities. Do not assume unlimited repairs fit the current monitoring allowances or open paid enrollment during research.

## Autonomy sequence

| Stage | Customer work | Required product behavior |
| --- | --- | --- |
| Assisted repair | Owner acts in their coding environment | Complete context and explicit verification continuation |
| Prepared repair | Owner requests a repair, reviews the resulting code and merges | Actual patch, preview checks, useful PR and automatic post-deploy verification |
| Automatic proposals | Owner enables a standing policy for eligible repositories and issue classes | Detection can prepare bounded PRs without a fresh request, with deduplication, limits, revocation and noise control |
| Bounded automatic release | Owner explicitly enables a narrow merge/deploy policy | Protected branches, required independent checks, exact commit/deployment identity, interruption controls and tested recovery procedures |
| Broader product improvement | Owner agrees goals and experimentation policy | Behavioral evidence, measurable outcomes and guardrails for changes that involve product judgment |

Prepared repair is the first competitive release target. Automatic proposals can follow observed usefulness. Automatic release is a separate product decision after the preceding stages prove dependable. Neither a writer's completion message nor a passing generated test grants merge authority.

## Behavioral intelligence

Elu's behavioral angle is a real competitive dimension. FixFlags can begin with failures it independently reproduces without waiting for visitor traffic. Later, one existing analytics connection could add affected-user counts and repeated friction for a specific journey, subject to appropriate access and privacy boundaries.

Prioritize that integration only when it changes a concrete decision: which Flag matters, which failure to reproduce, or whether a deliberate improvement helped. Preserve evidence distinctions between observed user behavior, synthetic reproduction and a causal business-impact claim. Do not build a replay warehouse or infer that an unused control is broken.

The existing privacy direction prefers synthetic verification and purpose-specific signals, with no default session replay and no assumed training permission. A larger observer would require an explicit collection and retention design. [Privacy direction](../../knowledge/privacy.md)

## Trust and commercial credibility

Earn proof alongside the repair product:

1. Publish permissioned case studies with a real failure, useful patch, preview result, deployed verification and accurate scope. Identify controlled examples as demonstrations.
2. Recruit a small, named design-partner cohort and ask for attributable feedback after delivered value. Testimonials require the speaker's approval. Do not invent people, quotations, usage totals or financial outcomes.
3. Provide a practical security overview: collected data, repository permissions, AI processing, retention/deletion, revocation, incident contact and available processing terms. Substantiate claims against actual operations and the applicable agreements.
4. Assess penetration testing and independent SOC 2 readiness against buyer requirements and budget. Do not imply a completed audit from internal controls or provider badges. Funding, compliance evidence and customer outcomes answer different buyer questions.
5. Establish the founder offer around a supported job, such as preparing and verifying a repair for a reproducible website failure. Measure demand and delivery economics before changing packaging.

The website should lead with the strongest demonstrated outcome and make no-setup public-page analysis visible. Describe the optional repository connection where repair needs it. Use real recovery evidence as the first trust asset while customer references and formal assurance develop.

## Ordered delivery and decision gates

These are acceptance milestones, not calendar promises. The current completion plan owns existing reliability and production prerequisites; reuse its evidence rather than creating another foundation program.

| Order | Deliverable | Exit evidence |
| --- | --- | --- |
| 1 | Prove the existing owner loop on an authorized public target and select one repairable failure family | A meaningful finding, usable instructions, actual repair, independent live recovery, recurrence and continued monitoring on the same Site. Resolve consequential failures already recorded in the completion plan. |
| 2 | Complete one connected-agent client journey | Real client retrieves full source-bound evidence, makes a useful change, records deployment, resumes after interruption and obtains independent verification. Scope and revocation failures remain explicit. |
| 3 | Prototype hosted prepared repair | One supported framework/repository/preview path produces an actual patch and independently checked preview from an observed Flag. No default-branch or production mutation. |
| 4 | Validate generalization and economics | A proposed benchmark of 20 controlled regressions across at least three independent repositories, with held-out cases, then five permissioned real repair attempts. Record every eligible, ineligible, failed and successful attempt. These sample counts are proposed evaluation sizes, not performance claims. |
| 5 | Deliver the pilot and proof-led website | Real owners can request, review and deploy useful repairs; FixFlags verifies recovery and continues monitoring. Publish only approved examples and claims supported by those outcomes. |
| 6 | Decide on standing proposals and later automatic release | Measured patch acceptance, regression rate, owner effort, cost and operational reliability justify the next autonomy level. No automatic expansion of permission. |

The connected-agent channel and hosted runner share the repair brief and verification contract. The hosted runner does not need to wait for all editor clients to launch; one proven client path is enough for the initial channel milestone. Reliability, permission and evidence prerequisites still apply to both.

The website workstream can develop its storyboard and composition while product proof progresses. Public repair automation claims wait for the corresponding delivered capability. Product implementation, paid provider runs and external publication are separate actions from this research. End-to-end tests remain subject to the explicit-request rule in AGENTS.md.

## Measures of competitiveness

The primary measure is the share of eligible, observed failures that become independently verified deployed repairs with acceptable owner effort. Record the complete path: eligible Flag, repair requested, execution admitted, patch produced, preview accepted, PR accepted, deployment observed and live recovery verified. Include all failures and unknown outcomes in their appropriate denominators.

Track detection precision and usefulness, time to first actionable evidence, time to a useful patch, owner intervention time, patch acceptance, unrelated regressions, cost per attempted and recovered repair, and recurrence caught by monitoring. Separate consented visitor analytics from durable product-execution facts.

Choose numerical success thresholds before the pilot, against baseline delivery cost, desired service economics and acceptable repair risk. A small benchmark supports a narrow release decision; it cannot establish general autonomy, conversion lift or product-market fit.

## Remaining competitor questions

- With an authorized workspace, reproduce one failure and observe setup, finding quality, code proposal, preview checks and post-deploy behavior. Record the owner's actual actions and elapsed time.
- Establish the conditions for autonomous merging and reconcile them with the public terms.
- Obtain actual plan limits and pricing from an authorized trial or written offer.
- Request the claimed assurance material if enterprise evaluation becomes relevant, including report scope and availability.
- Ask for an attributable customer walkthrough or permissioned reference. Public testimonials alone cannot settle patch quality or causality.

The recommendation does not depend on disproving Elu's claims. A serious competitor is already packaging detection and repair into a compelling offer. FixFlags needs a reliably delivered, low-effort path from a live failure to an independently verified repair, with proof that customers can inspect.
