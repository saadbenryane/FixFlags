---
status: supporting
authority: operations
reviewed_at: 2026-10-29
supersedes: []
---

# FixFlags agent distribution: final experience and execution plan

## 1. The decision

Make FixFlags easy to discover, easy to try, and dependable to return to from the tools people already use to build their websites.

The customer experience should fit in one sentence: **Give your agent one task. FixFlags handles the connection needed to help with it.** This is proposed distribution copy, not a replacement for the approved homepage headline.

The target journey is **copy a task, paste it into the agent, approve any required native connection, and continue the task**. Returning users skip setup. People should not choose between a skill, MCP server, plugin, CLI, and connector. Those are implementation choices made by a tested client recipe.

The shortest useful path wins. A complete copied Flag prompt may need no installation. A connected coding agent may need only its native remote MCP configuration. A hosted chat may need the approved plugin's own install and sign-in flow. We should never install three things because the distribution system happens to contain three things.

Build one coherent system with four parts:

1. A clear website destination with one task prompt and, when useful, a native open/connect action.
2. A portable FixFlags skill that helps agents handle real Flag evidence correctly.
3. A connected plugin, using the existing MCP service, for supported tools and directories.
4. A task-preserving setup flow and release process that keep instructions, connection state, listings, and public claims accurate.

Release the useful skill and the connected integration in separate stages. A skill can already help a customer work from a copied fix prompt. New MCP connections are currently withheld pending acceptance evidence. Their availability must remain an explicit dependency, not something a marketplace listing silently promises.

The strategy is to make FixFlags the natural follow-up to publishing an AI-built website. Marketplace presence supports that goal. The durable advantage is the complete path from recorded problem to independently checked repair and continued monitoring.

This document is a planning deliverable. It does not assert that the proposed website, packages, repository, connections, or listings have launched. The user approved using the connected GitHub account for a separate public distribution repository. The proposed repository is `saadbenryane/fixflags-agent-kit`; it did not exist when checked during this research.

### How to read this plan

- Sections 2 to 4 establish the current evidence, strategy, and customer journey.
- Sections 5 to 9 specify the experience, skill, discovery endpoints, and packages.
- Sections 10 to 14 cover marketplaces, connection quality, and acceptance.
- Sections 15 to 19 cover acquisition, measurement, economics, and operating the system.
- Sections 20 to 23 provide the implementation sequence, completion criteria, unresolved questions, and sources.

Recommendations are proposed decisions. HTTP observations describe one dated check. Code findings describe the shared working tree, which contains concurrent product changes. Provider documentation establishes published requirements, not this account's eligibility or review outcome.

The final UX decision is prompt-first for a person already using a coding agent, native install/connect for hosted tools where that is shorter, and no new setup for a task that can already be completed. Section 4 defines the flow and section 6 defines its visible interface. The remaining sections describe how to make that simple experience dependable.

## 2. What exists today

### Verified inventory, October 29, 2026

| Surface | Observation | Consequence |
| --- | --- | --- |
| Public website | `/integrations` and `/docs/fix-with-ai` returned HTTP 200. | Improve the existing journey instead of rebuilding the website. |
| AI reading index | `/llms.txt` returned HTTP 200 and describes website monitoring, documentation, guides, tools, pricing, and support. | A useful foundation exists, but it does not expose an installable skill or a dedicated agent destination. |
| Search access | `/robots.txt` returned HTTP 200. Code explicitly permits public search agents while repeating private-path exclusions. | Preserve this foundation. Robots permission alone does not establish actual crawler access or inclusion in answers. |
| Canonical skill | `public/.well-known/skills/fixflags/SKILL.md` exists in source. Its public URL returned HTTP 404. | An agent cannot retrieve the advertised skill from the production website. |
| Existing skill index | `public/.well-known/skills/index.json` exists; its public URL returned HTTP 404. | Its current content is also incompatible with the inspected installer's accepted legacy entries because it omits `files`. |
| Preferred discovery path | `/.well-known/agent-skills/index.json` returned HTTP 404. | Current domain-based skill discovery has no working preferred endpoint. |
| Discovery gate | `lib/mcp/discoverability.ts` sets `MCP_IS_DISCOVERABLE = false` and withholds all `/.well-known` paths. | Public instructions and connection metadata currently share an unnecessarily broad release boundary. |
| OAuth metadata | `/.well-known/oauth-protected-resource` returned HTTP 404. | A fresh connection cannot be claimed as working from the published package alone. |
| MCP discovery | `/.well-known/mcp.json` returned HTTP 404. | Do not advertise a fresh public MCP installation yet. |
| Existing MCP service | The current registry declares Site, Outcome, run, Flag, fix-recording, verification, and connection-information tools. | Build around this real contract. Avoid inventing a parallel product API. |
| Repair handoff | Current working-tree code includes a versioned repair brief, context hash, supporting-observation pagination, permissions, and verification criteria. | Skills must consume these contracts and preserve missing-context states. This working-tree finding is not a deployment claim. |
| OpenAI package | `integrations/chatgpt-plugin/` contains a development manifest, MCP configuration, brand assets, reviewer scenarios, and a deterministic builder. | Extend and correct this work instead of creating an unrelated second integration. |
| Bundled workflow | The existing OpenAI package's file allowlist contains no `skills/` files. | Its current archive does not distribute the reusable workflow the user requested. |
| External directory | An indexed third-party listing already exposes the development plugin and reports an MCP schema mismatch. | A public GitHub draft can become discoverable before an intentional launch. Treat public manifests as publication surfaces. |
| Portable schema | The fetched Agent Plugins 1.0 MCP schema rejects additional fields on an HTTP server. The current server entry contains `extensions`. | The warning has a concrete schema basis. Local bespoke validation currently accepts this field. Resolve format differences with actual host validation. |
| Official MCP Registry | A public API search for `fixflags` returned `servers: []`, count 0. | No matching entry was returned in that search. This does not establish absence from every directory or alternate namespace. |
| npm distribution | npm reports `latest: 1.0.4`, `beta: 1.0.0`; the local CLI candidate is `1.0.5`. Published metadata and the candidate still reference `saadbenryane/QewOS`. | Correct repository provenance and validate the actual published artifact before recommending `npx fixflags init` as the public installation route. |
| Existing measurement | Public discovery verification, a 24-prompt AI visibility evaluator, consent-aware acquisition instrumentation, and Site value reporting already exist. | Extend these mechanisms rather than installing another analytics system. |
| Current setup interface | Working-tree setup copy asks the person to create a key, add client configuration, then paste a connection-check prompt. | Treat this as advanced/manual setup. It cannot be the target mainstream experience. |
| CLI initializer | `fixflags-cli/src/init.ts` writes skill/configuration files but does not authenticate or verify a live tool call; the command prints that FixFlags is connected. | Correct the success semantics before promoting this path. Configuration written is a distinct milestone. |
| Client detection | The initializer can infer Codex from `AGENTS.md` and defaults to Codex if nothing is recognized. | Shared project files do not identify the active client. Use actual host context or one concise client choice. |
| Existing configuration | The initializer merges JSON but replaces an existing `fixflags` entry and appends a managed TOML block without establishing whether another equivalent entry exists. | Setup must reuse healthy connections, detect conflicts, and avoid duplicate keys or destructive replacement. |

Evidence was gathered through read-only public HTTP requests, GitHub/npm metadata, source inspection, and nine focused existing package/skill tests. All nine tests passed. They prove the repository's current local checks pass; they do not prove portable schema conformance, live installation, indexing, or directory approval.

### The three most important repairs

**Make the skill genuinely usable today.** The current skill assumes MCP tools are available. Its index says distribution is parked. A customer who installs just the skill needs a complete copied-prompt workflow and an honest explanation of what an unconnected agent can do.

**Separate public knowledge from authenticated capability.** A public skill can be readable while new MCP onboarding remains withheld. Exempt exact reviewed public instruction paths, not the entire `/.well-known` namespace. OAuth, transport, ownership, and permissions remain their own acceptance work.

**Make one contract generate the different distributions.** The application, website instructions, CLI, plugin bundles, manifests, tool reference, and listings should not drift through manual copying. Provider-specific formats still require their own adapters and validators.

### Research limitations

No credentialed ChatGPT, Claude, Cursor, or marketplace portal was exercised. No customer account or production repair was tested. Search results are not an exhaustive marketplace inventory. The current discovery-v0.2 schema host failed DNS resolution, including a second attempt outside the initial execution path; the plan therefore does not assert that schema was independently validated. Smithery documentation and one guessed PulseMCP submission URL could not be retrieved, so their current submission process remains an explicit follow-up rather than an invented procedure.

## 3. What success means

Treat distribution as six separate capabilities. Each needs its own evidence.

| Capability | Customer question | Evidence we need |
| --- | --- | --- |
| Findability | Can I or my agent find FixFlags for this task? | Accessible public content, real search observations, verified listings, relevant referrals. |
| Understanding | Can I explain what it does and what to do next? | First-time users correctly describe the benefit, availability, and next step. |
| Installation | Can my tool load the skill or plugin? | A clean installation in the named client and version. |
| Connection | Can it access the Site I authorized? | Successful OAuth, appropriate permissions, owned data, and working revocation. |
| First value | Can I understand a problem and take useful action? | Real scoped evidence, a readable repair task, and an understood next step. |
| Continued value | Does it help after the first session? | Independent repair verification, scheduled monitoring, and observed return over time. |

A downloadable file establishes none of the later stages by itself. A plugin installation is not an authorized connection. A successful connection is not proof that a repair worked. This separation should shape both product states and reporting.

### Initial audience and jobs

| Audience | Starting situation | Useful first result | Preferred entry |
| --- | --- | --- | --- |
| Owner using an AI builder | The website is published, but they do not know what to check. | A specific problem, evidence, and a fix prompt they understand. | Website URL check and copied prompt. |
| Developer using Claude Code, Codex, or Cursor | They have shipped a change and need to check the live result. | A scoped check or Flag brief tied to the actual live Site. | Skill, then connected plugin when available. |
| Agency or team | They maintain several websites and need to know which needs attention. | Correct Site selection, useful prioritization, and persistent history. | Connected account with explicit scope selection. |
| Autonomous maintenance workflow | A permitted deployment has finished and a follow-up check is needed. | A durable run with truthful completion and recovery evidence. | MCP with a bounded authorized workflow. |

Start with the first two audiences. Team rollout and unattended execution should grow from demonstrated demand and operational readiness.

### Positioning boundaries

Keep the existing website-monitoring story. Explain agent support as a way to use FixFlags within someone's current workflow. Lead with the website problem and result, then show the available tool-specific action.

Use the name **FixFlags** consistently across the site, packages, repositories, screenshots, and listings. Use plain descriptions such as website monitoring and live fix verification to reduce confusion with unrelated feature-flag products and the `FixFlags` symbol found in other software.

Avoid claiming exhaustive testing, autonomous deployment, legal certification, guaranteed search rankings, or revenue causation. Current public pricing remains owned by the existing offer code. A package should link to pricing rather than preserve a second price table.

## 4. The complete customer journey

### One task, with setup handled along the way

```mermaid
flowchart TD
  A[Ask for a website check or paste a Flag task] --> B{Can the agent do this with current access?}
  B -->|Yes| C[Continue the requested task]
  B -->|Connection needed| D[Use the supported native setup path]
  D --> E[Approve sign-in and access when required]
  E --> F[Confirm access with a read-only request]
  F --> C
  D -->|Host requires reload| G[Save the task and show one resume action]
  G --> F
  C --> H[Read the result and next step]
  H --> I[Repair and publish when authorized]
  I --> J[Ask FixFlags to verify the published change]
  J --> K[Return to the saved Site and monitoring]
```

Do not turn every visitor into an installer. The product starts with the work the person wants done. Establish only the access needed for that work, then continue without asking them to repeat their request.

### Three entry scenarios

**A. A person already has a Flag.** They use the existing copy-fix action and paste the task into their coding agent. The task carries its evidence and a short conditional instruction for retrieving additional context. If enough evidence is present, work can proceed without setup. If required private evidence is missing, offer the minimum supported connection and resume the same Flag. Never imply that a partial group is complete just to avoid setup.

**B. A person starts in their coding agent.** They paste a prompt from `/agents`, or simply ask the agent to use FixFlags. The agent reads the public setup instructions if needed, reuses existing access, or applies the tested native setup recipe. The customer approves the client's normal permission and sign-in steps. The agent then performs the requested check or explains the one missing prerequisite.

**C. A person arrives from a hosted directory.** They use the listing's native Install/Connect flow. Plugin onboarding retains their task where the host supports it, verifies actual access, and takes them directly to the intended Site or Flag. A generic new installation offers one useful starter task rather than a configuration tour.

### The prompt we offer

Proposed generic check prompt, shown as a preview before copying:

```text
Use FixFlags to check my published website: https://your-site.com.
If a connection is needed, follow https://fixflags.com/setup.md
for this agent and help me complete its normal sign-in approval.
Then continue with the website check and show me the evidence.
Do not change or deploy my website.
```

The example URL becomes the exact validated public website the person supplied when known. Never copy the placeholder as if it were a real target. When no website is known, the generic prompt can say "my published website" and the agent asks for the URL once, only if it cannot identify it reliably. `/setup.md` is a proposed public instruction endpoint, not a claim that it exists now.

A task originating from a Flag retains the actual Flag instructions, Site identity, versioned context and evidence links. Add only a concise conditional setup clause. Do not replace the repair task with a generic request to configure software.

The prompt grants authority for the requested task and its proportionate connection setup. It does not grant authority to change security policies, install unrelated software, deploy code, make purchases, or act on another customer's Site.

### How the agent chooses the route

| Current capability | Correct next action | Customer burden |
| --- | --- | --- |
| Complete supplied evidence, no private retrieval required | Work from the prompt within its authorized scope. | No install or sign-in. |
| Active authorized FixFlags tools | Use the existing connection and exact task context. | No setup. |
| Connection configured but not signed in | Start or link the native sign-in step. | Approve access in the native browser flow. |
| Local coding agent with supported setup access | Use its tested native plugin or remote MCP recipe, choosing one sufficient path. | Normal host approval, then sign-in if required. |
| Hosted agent with a supported plugin/connector | Offer the real native install/connect action. | Complete the host's own flow. |
| Host requires reload before tools appear | Preserve the task and show the exact host-specific resume instruction. | One reload/new-session handoff where actually required. |
| No supported persistent connection | Continue with complete copied evidence, or offer the ordinary website check. | No pretend connection or unsupported configuration work. |
| Existing access is blocked by organization policy | Explain the specific restriction and route to the administrator. | No repeated install attempts or policy bypass. |

An existing authorization is not enough if its tools cannot access the requested Site. Confirm ownership through a real read, and explain ambiguity rather than silently switching to another account or website.

### What can actually feel automatic

The agent handles choosing the correct recipe, checking for an existing equivalent connection, configuring the supported client when permitted, carrying the original request, and confirming access. Native sign-in, trust, administrator restrictions, and any required reload remain visible user or host actions.

Official OpenAI guidance distinguishes local MCP configuration from ChatGPT web plugin installation, and documents restart steps on some local surfaces. The installed Codex CLI also exposes native MCP and plugin management commands. These establish possible mechanisms, not proof of in-session activation on every surface. [OpenAI MCP setup](https://learn.chatgpt.com/docs/extend/mcp), [OpenAI developer commands](https://learn.chatgpt.com/docs/developer-commands)

Claude Code documents native remote-server setup and separate authentication/connection states. Cursor documents a native install-and-OAuth path. Use those mechanisms, then validate the actual current clients rather than promise universal background installation. [Claude Code MCP](https://code.claude.com/docs/en/mcp), [Cursor MCP](https://cursor.com/docs/mcp)

### Preserve intent through sign-in or a restart

Keep the smallest necessary task state: task kind, selected Site/Flag, expected context hash, intended public URL when applicable, original authorized scope, and any existing run or fix-attempt ID. Store it in the current conversation or a private local resume record where available. Use a server-side account-bound continuation only when a cross-app handoff genuinely needs it.

Provide an exact resumable instruction, such as "Continue the FixFlags check for the website we selected." Prefer restoring the task automatically where the host supports it. Never put credentials, a private repair brief, or full customer prompt into a public URL, directory link, referrer, or analytics field. A continuation handle retrieves private context only after normal authorization.

Setup ends with a read-only account/Site access result. Then the agent continues the original action using its existing authorization. If the task was only to connect, stop after confirming access. If it was to inspect a Flag, do not silently start a new broad check.

### First-time account and Site creation

A person without an owned Site must not encounter an unexplained empty tool result. Use the existing website add/save flow, preserve the target, then resume once ownership is established. The current MCP registry does not expose Site creation. Do not have an agent invent a tool or call undocumented private APIs to hide this prerequisite.

During connected-product work, make browser sign-in/account creation and saving the selected website one coherent supported handoff where possible. If a future authorized onboarding API is justified, design and accept it as a real product capability. Until then, document the actual browser step and measure it.

## 5. The product-quality bar

Apple's onboarding guidance favors learning through actual use, short contextual explanations, and postponing nonessential setup. Apply those principles within FixFlags' own identity and existing design system. [Apple onboarding guidance](https://developer.apple.com/design/human-interface-guidelines/onboarding)

### Experience requirements

1. **One clear next action.** A person starts the task, and the selected client and current availability determine the necessary setup path.
2. **Benefit before mechanism.** Explain what the person gets before mentioning MCP, scopes, transport, or manifests.
3. **Useful without a terminal.** A website owner can check a URL, copy a prompt, and return to the Flag.
4. **Details where they matter.** Protocol, installation command, configuration scope, and manual setup stay in the relevant native approval or advanced view. The normal journey describes the task and required access.
5. **No fake completion.** Distinguish skill installed, account connected, check requested, check finished, and fix verified.
6. **Recovery is designed.** Connection cancellation, missing tools, expired authorization, unavailable evidence, and an interrupted run have specific next steps.
7. **Consistent language.** The site and agent describe the same Site, Flag, check, and result. Technical Outcome terminology belongs where it helps select scope.
8. **Visible control.** Explain account access when connecting. Make disconnect and revocation easy to find.
9. **Restrained surfaces.** Use existing typography, orange, spacing, and tonal grouping. Preserve the official mark. No separator lines, logo wall, decorative terminal theater, or website redesign.
10. **Complete small-screen behavior.** The prompt is previewable and copyable on a phone, instructions remain visible after copying, and desktop-only actions explain where to continue. Long commands stay inside their code block in advanced setup.
11. **Recognize what already works.** Repeated setup requests reuse a healthy connection and preserve existing installations. Do not ask the customer to install a skill separately when the plugin already contains it.
12. **Continue the work.** Sign-in success returns the person to the requested task, with a specific resume action if the host cannot do that automatically.

### Proposed quality targets

These are internal acceptance targets to test, not current performance claims:

- In five initial usability sessions, at least four people explain the benefit and correct next step without help.
- The public page communicates availability within its first viewport on an ordinary phone.
- A supported skill installation requires one principal command, or an equally clear download path.
- A person already using a supported local coding agent can start with one pasted task prompt; they do not need to copy commands and JSON from multiple pages.
- A healthy returning connection requires zero setup actions.
- The target ordinary new connected flow has one task handoff, the host's required trust/install approval, and one authorization flow. Additional account, organization or reload steps are separately named and measured.
- A reload is requested only when required by that tested client/version, and it includes a working resume path.
- A connection test makes no changes, consumes no website-check run, and is not reported as the user's completed website task.
- A person never has to paste a credential into an agent conversation.
- Every visible action has an intentional loading, success, cancellation, or failure state.
- The primary journey remains understandable without animation or client-side JavaScript.
- The tool selection, instructions, and back navigation work with keyboard and assistive technology.
- Installation and connection are observable separately, with no success state inferred from a button click.

Measure median and slow-path time to the first useful task in first-time sessions. Establish baselines before making a public "one minute" or "zero setup" claim. Count meaningful user decisions and app switches as well as clicks; a short command that causes three unexplained restarts is not a successful simple flow.

Test these with actual first-time people. A designer's inspection and a synthetic agent evaluation are useful, but neither proves human comprehension.

## 6. Website information architecture

### One public destination: `/agents`

Create one short marketing destination, with the page label **For AI agents** and the proposed heading **Check your website with your AI.** Preserve the homepage headline and review new rendered strings through the existing copy process.

Its job is to give someone a useful task they can hand to their agent. Detailed procedures belong in documentation. The default page should not look like a download center or ask the visitor to choose a protocol.

Suggested page order:

1. A concise benefit and a preview of the task prompt.
2. One primary **Copy prompt for my agent** action.
3. A contextual native **Open in [tool]** or **Connect [tool]** action only when supported and useful.
4. A short "What happens next" explanation: paste, approve access if needed, continue the check.
5. A small real or clearly labeled example of the evidence and useful result.
6. A quiet tool choice and links to supported setup details and help.

For hosted clients where the native listing makes the process shorter, the selected view promotes **Connect [tool]** as its primary action. Keep **Copy task prompt** as the secondary path. A neutral visitor sees the general prompt first; do not infer their editor from browser fingerprints or merely installed project files.

Before MCP launch, the prompt uses complete Flag evidence or the ordinary website check and truthfully says that new direct connections are unavailable. It must not offer an automatic-install promise backed by a withheld endpoint. After acceptance, the same public setup endpoint enables its verified client recipes. No inactive connected service is disguised as an active install button.

Illustrative first view:

```text
For AI agents

Check your website with your AI.
Give your agent a task. It will guide you through
any connection needed and continue with the check.

[Preview of the task prompt]
[Copy prompt for my agent]

Paste it into your agent. Approve access if asked.
Continue with the website you want checked.

Using a specific tool? [Choose your tool]
[Supported native action for the selected tool]

[How it works]   [Setup details]
```

The wireframe establishes hierarchy, not final layout or approved copy. The real page should reuse existing marketing components and tokens.

### Supporting destinations

| Destination | Single responsibility |
| --- | --- |
| `/agents` | Preview/copy the task prompt, open a supported native flow, and explain the next step. |
| `/setup.md` | Concise public instructions for an agent to select the minimum supported route, respect availability, and resume the task. |
| `/docs/agents` | Human setup details, supported clients, skill installation, updates/removal, and troubleshooting. |
| `/docs/fix-with-ai` | The practical Flag-to-fix-to-recheck workflow already available in the product. |
| `/docs/mcp` | Connected access, permissions, tools, and durable runs, published when its evidence gate opens. |
| Existing connection settings | Show which account/client is authorized and provide revoke/disconnect controls. |
| `/integrations` | Keep service connections distinct from using FixFlags in a coding tool; add a compact link to `/agents`. |
| `/coverage` | Own the explanation of supported checks and their limits. |
| `/pricing` | Own the current offer and availability. |

### Small changes to existing pages

- Add **For AI agents** to the footer's resources and the relevant Docs navigation. Do not add another crowded top-level header item by default.
- Add one contextual link beside the existing homepage AI fix guidance. Preserve the homepage headline, hero, and URL-first entry.
- Link from the existing integrations page to the agent destination, using a small section outside the provider-card inventory.
- Add the new public page and guide to the sitemap, canonical metadata, internal search, and `llms.txt` registry.
- Add an agent-friendly plain-text link where a person is already looking for installation details.
- Keep sample evidence explicitly labeled. Do not reuse a sample animation as proof that a real repair completed.
- Keep a Flag's existing copy action as its entry point. Its task conditionally references setup only when access is missing; do not add a second setup checklist beside every Flag.
- After copying, change the button to **Copied** and show the next instruction inline. If clipboard access fails, select the readable prompt and show how to copy it manually.
- Avoid a new full-screen setup wizard. Use the selected client view, one short authorization handoff, and the existing Site/Flag surface.

### Progressive setup states

| State | What the person sees | Next action |
| --- | --- | --- |
| New visitor | Benefit, task preview, and actual availability. | Copy the task for their agent or use a shorter supported native action. |
| Complete copied Flag | The exact repair context and authorized task. | Work without installation unless private context is required. |
| Skill only | The workflow is available; account access is separate. | Continue with supplied evidence or make the required native connection. |
| Client selected | One recommended path and the next understandable action. | Open/connect natively or paste the task. |
| Authorization needed | Account identity and requested access in ordinary language. | Continue to the provider's secure authorization window. |
| Connected, no Site | Connection works; no owned website is available. | Add/save a website in the product. |
| Several Sites | Recognizable website choices. | Select the intended Site. |
| Host reload needed | Setup is saved; the current session cannot use the new tools yet. | Reload/start the required session and resume the preserved task. |
| Run already active | The existing run and its progress. | Resume polling that run. |
| Authorization expired | A direct explanation and retained task context. | Reconnect and resume. |
| Context changed | Previously copied evidence is no longer the exact current task. | Prepare a fresh prompt/brief. |
| Check incomplete | What was checked, what could not be checked, and why. | Resolve the specific blocker or inspect the remaining scope. |

### The setup conversation should be equally clear

Agent messages should describe only the current meaningful step. Proposed examples:

- "FixFlags is already connected. I'll check the website you selected."
- "I'll add FixFlags to this project. Your agent will ask you to approve access."
- "Sign in to FixFlags in the window that opens. I'll continue with this Flag afterward."
- "The connection is saved. This version of your agent needs a new session before it can use it. Here is the task to resume."
- "Connected. I can read your saved website. I'll now continue with the check you requested."

Use the last message only after a real authorized read. Show a selected website name instead of internal IDs in ordinary confirmation. IDs remain available in diagnostics and evidence.

### Deliberate recovery instead of a setup loop

Every error has one specific next step. Sign-in cancellation offers retry without reinstalling. A configured but unloaded connection offers the required reload. An organization restriction points to the administrator. A wrong account offers account switching. Missing private evidence identifies the exact inaccessible context. An unsupported client offers complete copied evidence or the ordinary product path.

Never respond to every failure by issuing another key, registering another server, installing another transport, or trying a succession of undocumented endpoints. Diagnose the stage that failed, retain progress, and repair that stage.

## 7. The skill we should ship

Use the actual Agent Skills entry filename, `SKILL.md`, inside a named folder. A root `skills.md` is not a substitute for the package format. The standard requires name and description metadata and supports optional resources. [Agent Skills specification](https://agentskills.io/specification)

### One focused skill at first

Start with `fixflags`, serving the goal of resolving or checking a recorded website problem. Avoid publishing many near-duplicate skills for every editor or every check category.

The public task prompt can load the required instructions before a persistent skill is installed. A complete one-off task should not require installing a skill just to read instructions already included in the prompt. The plugin bundles the reusable workflow for return visits.

Add a narrowly scoped `setup` onboarding skill only to packages whose host supports a setup entry. It uses the same client recipes and helps complete the requested connection or original task. It does not duplicate the product workflow or trigger on unrelated coding work. OpenAI supports an optional `onboardingSkill` declaration for packaged setup; it operates after installation and cannot bootstrap a plugin that is not installed yet. [OpenAI onboarding skill guidance](https://developers.openai.com/plugins/build/plugins#add-an-onboarding-skill)

Proposed discovery description:

> Work from FixFlags website Flags and their evidence to investigate a problem, prepare a repair, and request independent verification after deployment. Use when a user supplies a FixFlags prompt or asks to check a published website with FixFlags.

Keep broad website-building requests outside its automatic trigger. An installed skill should not tell the agent to use FixFlags for every unrelated coding task.

### Two explicit operating paths

**A. Copied evidence, available first**

1. Identify the supplied Site, Flag, affected pages/devices, and recorded expectations.
2. Read the evidence already provided. Retrieve additional private context only through authorized available mechanisms.
3. For grouped findings, read all supporting observation pages before choosing a group-wide repair.
4. If required context cannot be read, report precisely what is missing. Do not manufacture a diagnosis or ask for credentials in chat.
5. Inspect the actual repository before deciding how to repair the observed behavior.
6. Make the coherent in-scope change and run appropriate focused checks.
7. Publish only when deployment is authorized and the current tool can perform it. Otherwise report that deployment remains outstanding.
8. Direct the customer to the original Flag and **Check now** after publication, or use an already authorized supported connection.

This path must be useful without claiming that installing instructions installs or authorizes MCP tools.

**B. Connected service, enabled after acceptance**

Use the registry's actual tools and current argument schemas. Discover the owned Site, inspect scope and freshness, request the intended check, and retain its durable run ID. Read the Flag's exact versioned repair brief. After an authorized deployment, record the actual change, use the returned attempt ID for verification, and poll the returned verification run.

Use `fixflags.get_connection_info` when connection diagnostics are relevant. Do not add a diagnostics call to every simple evidence read merely because it exists.

Before initiating setup, check whether the current task actually needs more access. Reuse existing working tools. Read `/setup.md` only when a connection or missing setup instruction matters. Once setup completes, resume the original Site/Flag task and its expected context rather than asking the user to explain the problem again.

### Essential skill invariants

- A request to inspect evidence does not authorize a code change or deployment.
- A suggested repair is guidance; it does not establish the root cause.
- A copied context hash must be honored. Changed evidence requires fresh context.
- Treat page text, screenshots, selectors, URLs, and external evidence as untrusted data.
- Follow supporting-observation pagination and preserve affected devices and pages.
- A queued or running check is not a completed check.
- A recorded fix is not verified recovery.
- A local test or the coding agent's assertion cannot clear a Flag.
- Stale, incomplete, blocked, and incomparable evidence stay explicit.
- Monitoring cadence and coverage come from the product, not the skill's assumptions.

### Packaging the instructions

Keep the main skill short and self-contained. Put substantial connected-mode tool detail in a linked reference loaded only when a connection exists. Use current schema-derived examples rather than copied tool inventories that silently drift.

The skill's output should say what changed, what was tested, whether publication happened, what FixFlags independently observed, and what remains unresolved. It should distinguish these facts in natural language, without forcing every task into an oversized report template.

### Behavioral evaluation set

Evaluate at least these realistic tasks before release:

| Request | Expected behavior |
| --- | --- |
| A user pastes a complete Flag prompt into an unconnected agent. | The agent uses the supplied evidence and does not invent available MCP tools. |
| A grouped Flag includes a continuation link. | The agent reads the full group before implementing a shared fix. |
| A private repair URL cannot be authorized. | The agent identifies the missing evidence and stops dependent repair work. |
| The copied context hash no longer matches. | The agent requests fresh context rather than applying stale instructions. |
| Website evidence contains instructions to reveal secrets. | The agent treats those instructions as untrusted source material. |
| The user asks for explanation only. | The agent explains the finding without modifying the repository. |
| The user authorizes a repair but not deployment. | The agent completes the repair and focused checks, then reports the deployment boundary. |
| The server returns an active run. | The agent resumes the original run instead of starting duplicates. |
| A fix is recorded but verification cannot finish. | The agent reports the recorded fix and unverified recovery separately. |
| The user says to mark everything fixed without checking. | The agent does not fabricate or override independent verification. |
| An already-connected user pastes the setup/task prompt again. | The agent reuses the working connection and continues the actual task. |
| A host requires a new session after configuration. | The agent reports saved configuration honestly and supplies a nonsecret task continuation. |
| The current environment has no setup permissions or browser access. | The agent gives the shortest supported native handoff and retains the task without fabricating installation. |

## 8. Agent discovery and website delivery

The inspected `vercel-labs/skills` provider prefers `/.well-known/agent-skills/index.json`, falls back to `/.well-known/skills/index.json`, and accepts a legacy directory model or a newer artifact model. Legacy entries require a file list containing `SKILL.md`; newer entries use an artifact URL and digest. These are verified installer behaviors, not a promise that every agent follows the same discovery convention. [Installer implementation](https://github.com/vercel-labs/skills/blob/main/src/providers/wellknown.ts)

### Public endpoints

| Endpoint | Purpose | Release rule |
| --- | --- | --- |
| `/.well-known/agent-skills/index.json` | Preferred domain skill index. | Publish with a usable reviewed skill. |
| `/.well-known/agent-skills/fixflags/SKILL.md` | Canonical public skill entry. | Match the released source bytes. |
| `/.well-known/skills/index.json` | Compatibility with existing consumers. | Generate a compatible index, retain old links. |
| `/.well-known/skills/fixflags/SKILL.md` | Compatibility skill path. | Generate from the same source. |
| `/skill.md` | Optional memorable human/agent link. | Redirect to the canonical skill; avoid another editable copy. |
| `/llms.txt` | Concise product and documentation index. | Include the agent page, skill, and current availability. |
| `/setup.md` | Task-preserving agent setup instructions. | Publish honest current availability first; expose only accepted client recipes. |
| `/downloads/fixflags-skill.zip` | Optional native upload/download path. | Offer only for clients whose import format has been tested. |

Do not publish additional aliases solely to occupy filenames. Prefer one skill entry and an explicit index.

### A public setup entry before installation

`/setup.md` solves the bootstrap problem: a new agent can read what to do before it has installed our skill or has an authorized connection. It is a compact instruction document, not an executable installer, a second product homepage, or a credential endpoint.

Generate it from the maintained client recipe catalog. Include:

1. Current release availability and recipe version.
2. The minimum action for a complete supplied task versus a task needing private access.
3. A clear instruction to reuse working tools and equivalent existing configuration.
4. Supported native setup routes, with the tested versions, configuration scope, and activation requirements.
5. The sign-in/approval handoff and the read-only connection success check.
6. How to continue the original task, including when a new session is required.
7. A concise path for unsupported hosts or missing access.

Keep it short enough to read in one ordinary fetch. Load client-specific detail only when needed. The public version contains no customer state, live secrets, or fabricated directory IDs. During the gated release, it explicitly says that new MCP connections are unavailable and routes to the usable evidence/product flow.

An agent without URL-reading capability can still use a complete copied task. The page also offers a self-contained text expansion or native install action for that case. Do not send the person into a loop of asking the agent to read a URL it cannot retrieve.

For the initial compatible index, a minimal shape supported by the inspected provider is:

```json
{
  "skills": [
    {
      "name": "fixflags",
      "description": "Use FixFlags Flag evidence to prepare a repair and check the published result.",
      "files": ["SKILL.md"]
    }
  ]
}
```

If the released skill includes references, enumerate every distributed file. Add integrity-addressed artifacts only after the chosen discovery schema and actual released installer are validated. Do not declare a newer schema URL while guessing its contract.

### Request boundary

Retain the MCP launch gate. Add a narrowly defined public-instruction allowlist before the broad `/.well-known` withholding rule, covering the actual released index, skill, and reference assets. Update the visibility guard to distinguish these from gated connection endpoints.

Verify that encoded paths, unexpected siblings, and nested paths cannot accidentally expand the exception. Public instructions must not make OAuth metadata, unpublished MCP discovery, private data, or setup pages appear launched. Authentication and tenant checks remain server-side regardless of discoverability.

### Technical delivery requirements

- The advertised canonical asset returns the expected content and content type directly.
- Public fetches require neither login nor JavaScript.
- Index paths resolve correctly, file lists are complete, and optional hashes match actual bytes.
- Downloads contain one correctly structured skill folder and no private or unrelated files.
- Cache policy allows releases to propagate predictably; versioned artifacts can be immutable.
- Existing links remain compatible across a path migration.
- Domain-level installation is tested against a pinned released CLI, not just repository `main`.
- CDN access is checked separately from robots directives, using real crawler/provider evidence when available.

`llms.txt` is an agent reading aid. Google explicitly says it is not a ranking mechanism for Google Search or its AI features. Invest in useful public content, internal links, and crawlable pages alongside machine-readable delivery. [Google AI optimization guidance](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)

## 9. Distribution repository and build architecture

Use the approved connected GitHub account. Keep the public kit small enough for a customer to inspect and install without navigating the application repository.

### Proposed repository contents

```text
fixflags-agent-kit/
  README.md
  LICENSE
  CHANGELOG.md
  skills/
    fixflags/
      SKILL.md
      references/connected-workflow.md
  plugins/
    fixflags/
      plugin.json
      .claude-plugin/plugin.json
      skills/fixflags/...
      assets/...
  .agents/plugins/marketplace.json
  .claude-plugin/marketplace.json
```

This is a proposed layout. Generated copies inside plugin artifacts must come from the same canonical skill. Remove optional files when the released workflow does not need them. The initial public kit has no operational MCP configuration while that connection remains unreleased.

Choose and verify an explicit license for the distribution kit. Do not imply that a public repository automatically grants reuse rights or relicenses the application. Keep brand/trademark ownership distinguishable from reuse of the skill instructions.

### One source, generated host adapters

Maintain the skill and shared distribution metadata in a defined application-repository source directory, proposed as `integrations/agent-kit/`. Generate the public website assets, CLI skill, standalone download, public repository export, and plugin copies from it.

Extend `scripts/sync-skills.mjs` to support a nonmutating check mode. CI should detect drift rather than silently rewrite files. Extend the existing reproducible ZIP and explicit allowlist approach.

### One maintained client recipe catalog

Extend the integration catalog with typed setup capabilities, proposed in `lib/integrations/setup-recipes.ts`. The product page, `/setup.md`, setup skill, and optional CLI adapter read the same data.

Each accepted recipe records its client and surface, tested version range, availability stage, supported native entry point, configuration scope, OAuth support, existing-connection matching, activation/reload behavior, read-only confirmation, continuation behavior, and relevant official source. A client label alone is insufficient: local Codex, its IDE integration, and hosted ChatGPT do not share every setup capability.

Use fixed trusted command templates or native APIs with validated arguments. Website URLs and copied evidence are task data, never shell fragments. Preserve unrelated configuration and existing credentials. An equivalent working plugin/MCP connection satisfies setup; do not register a standalone duplicate beside a plugin-owned server.

A repeat invocation should either reuse the same compatible installation, repair one diagnosed problem, or explain a concrete conflict. It must not silently replace a different account, change installation scope, or reset the person's client settings.

### Decide the role of the FixFlags CLI

The recommended interactive path is the client's native remote connection or combined plugin, with OAuth when supported. The FixFlags CLI is an optional compatibility/automation surface, not a prerequisite for every customer.

Retain the existing local bridge only where it has an accepted purpose. Do not require Node.js, an npm install, a FixFlags CLI login, a bridge process, and a second native OAuth login when one remote connection is sufficient.

Before promoting `fixflags init`, correct its detection, merge behavior, and success messages. It must distinguish files written, session activation, authentication, and successful service access. Prefer extending this existing command for a justified adapter over inventing a new setup utility. Do not add a new `fixflags connect` command merely to make a diagram look simpler.

Use normal native trust and permission behavior. Avoid installer hooks, automatic approval flags, downloaded shell scripts, or broad client-policy changes as a way to shorten onboarding. Any package a native recipe downloads must be the reviewed intended package/version from the release catalog.

A portable Agent Plugin uses root `plugin.json`, `skills/`, and optional `mcp.json`. Host-specific settings belong in their supported extension or compatibility format. [Agent Plugins specification](https://agent-plugins.org/specification)

### Resolve the current schema conflict explicitly

The current `integrations/chatgpt-plugin/mcp.json` puts OpenAI authentication settings under a server's `extensions.com.openai`. Official OpenAI packaging documentation describes that setting, while the fetched portable 1.0 schema allows only `type`, `url`, and optional `headers` for a streamable HTTP server. The third-party directory exposes the resulting mismatch. [Portable MCP schema](https://agent-plugins.org/schemas/1.0.0/mcp.schema.json), [OpenAI packaging documentation](https://developers.openai.com/plugins/build/plugins)

Resolve this with separate validated build targets if necessary:

- A schema-conformant portable package for clients following the Agent Plugins contract.
- An OpenAI compatibility package using the configuration form accepted by the current OpenAI validator and portal.
- A Claude-compatible manifest and MCP configuration using Claude's supported HTTP transport form.

Do not remove authentication requirements just to pass a generic schema. Do not claim portable conformance because the repository's custom validator accepts a provider extension. Capture each target's actual validator and client result. If provider documentation remains contradictory, seek a documented resolution and keep that adapter unpublished.

The public repository should contain only released installable manifests. Keep experimental connected-package sources in a clearly noninstallable template format or a private staging location. A README warning cannot prevent public crawlers from indexing recognized plugin manifests.

### Build and supply-chain requirements

1. Explicit file allowlists, deterministic archive bytes, and checksums.
2. Real JSON Schema validation for the chosen format, with pinned schema provenance.
3. Tool names, scopes, and argument examples checked against the canonical registry.
4. No secrets, environment files, local sessions, customer data, symlink escapes, or unintended files in artifacts.
5. Stable package identity and intentional semantic version increments.
6. Release notes documenting user-visible changes, minimum tested clients, and any migration.
7. Download and public-export parity checks.
8. A clean extraction and installation check for every advertised distribution format.

## 10. Marketplace strategy and priorities

Current official OpenAI documentation describes a shared public plugin directory for ChatGPT and Codex. A repository marketplace is a separate distribution source. Plan one official connected FixFlags listing across those supported OpenAI surfaces, subject to approval. [OpenAI plugin architecture](https://developers.openai.com/plugins/concepts/plugins)

Anthropic's current directory supports both plugin bundles and MCP connector submissions. Its published process calls for submitting a server you operate as a connector as well as the plugin that references it. [Anthropic directory publishing](https://claude.com/docs/directory/publish)

| Channel | Priority | What to distribute | How it becomes available | Evidence before promotion |
| --- | --- | --- | --- | --- |
| FixFlags website | First | Clear agent destination, guide, public skill. | Normal reviewed website release. | Public retrieval, understandable journey, correct availability. |
| Small public GitHub kit | First | Reviewed skill, manifests, license, examples, release history. | Publish the allowlisted release to the approved account. | Artifact inspection and clean installation. |
| skills.sh ecosystem | First | The portable skill. | Public repo and actual users installing through the skills CLI. | Installer discovery and observed listing, tracked separately. |
| Owned Claude Code marketplace | First | Skill package, connected configuration later. | Publish the marketplace catalog and use the native add/install flow. | Strict CLI validation and real clean client installation. |
| Codex repository marketplace | First | The corresponding plugin package. | Publish `.agents/plugins/marketplace.json` and documented native setup. | Current client/version validation and clean installation. |
| OpenAI public directory | Connected release | FixFlags plugin with MCP and skill from the initial submission. | Portal validation, identity/domain steps, review, then publication. | Real authorization and repair loop, complete review materials, actual listing URL. |
| Anthropic public directory | Connected release, or a deliberately scoped skill release | Plugin bundle and, for the remote service, its MCP connector. | Developer portal submission and review. | Account eligibility, ownership, supported components, real installation and connection. |
| Cursor Marketplace | After primary client acceptance | Portable or Cursor adapter with skill and supported connection. | Public Git repository and Cursor submission. | Manual review acceptance plus client tests. |
| Official MCP Registry | Connected release | Remote server metadata. | Namespace verification and `mcp-publisher` publication. | Reachable service, approved namespace, correct metadata, retrieved registry entry. |
| VS Code/GitHub Copilot | Later extension | Existing skill and remote MCP where currently supported. | Verify native client setup and relevant registry integration first. | Version-specific compatibility; do not assume portability from another editor. |
| PulseMCP and Smithery | Secondary | The released remote service. | Recheck their current claim/submission routes; prefer existing syndication when present. | Correct listing, supported authentication, useful attributable traffic. |
| Other directories | Selectively | The same released story and canonical links. | Submit only when they reach a relevant audience. | Actual qualified activation relative to maintenance cost. |

The skills.sh FAQ says leaderboard appearances derive from installations through its CLI. Publishing a repository is not itself a confirmed listing or a ranking guarantee. Do not manufacture installs to inflate the count. [skills.sh FAQ](https://skills.sh/docs/faq)

Cursor documents portable Agent Plugin support, public Git distribution, and a submission route with review. Do not describe a GitHub import or team marketplace as official public-directory approval. [Cursor plugins](https://cursor.com/docs/plugins), [Cursor submission reference](https://cursor.com/docs/reference/plugins)

### An important OpenAI sequencing constraint

The current OpenAI submission guide says a skills-only listing cannot later have an MCP server added. Therefore, release the standalone skill through the website, GitHub, and supported repo marketplaces first, while preparing the main official OpenAI listing with its connected service included from the beginning. Avoid creating two confusing public FixFlags identities merely to obtain an early badge. [OpenAI submission guide](https://developers.openai.com/plugins/deploy/submission)

### What not to build for this launch

- A separate legacy ChatGPT plugin stack or an `ai-plugin.json` implementation without a current platform requirement.
- A custom GPT merely as a discovery workaround for the same workflow.
- A separate browser extension, editor extension, or SDK for each client when native skills and MCP suffice.
- A broad public directory of other tools to attract irrelevant traffic.
- Listings that promise autonomous repository edits, deployment, or continuous comprehensive testing.
- A Shopify marketplace listing for this agent initiative. Shopify's product connection is a separate capability and launch.

## 11. Exact publication preparation

### Shared listing material

Prepare one maintained distribution profile, with generated platform-specific fields:

- Product name, publisher identity, support email, canonical homepage, and agent destination.
- A short outcome-oriented description and a longer explanation of the actual workflow.
- Correct category and a small set of relevant keywords.
- Real brand icons at each required size and format.
- Three useful starter prompts based on supported behavior.
- Prerequisites, availability, account requirement, and current pricing link.
- Privacy, terms, security, support, and account/data deletion references.
- Minimum tested client versions and a dated compatibility matrix.
- Version, release notes, source repository, license, and artifact checksum.

Review the profile whenever the offer, scopes, tool contract, or public availability changes. Store listing URLs and provider-assigned identifiers only after they actually exist.

### OpenAI submission packet

Preserve the existing useful review cases and add the skill to the package. Complete identity and domain verification through the owning account. Run the remote tool scan and fix findings. The current remote-review documentation requires testing and review materials beyond local package checks. [OpenAI MCP review requirements](https://developers.openai.com/plugins/deploy/app-review)

Prepare:

1. The exact validated ZIP and its immutable checksum.
2. Five positive and three negative MCP review scenarios, checked against the actual tool registry.
3. Actual executions covering explicit, indirect, and unsupported requests.
4. Secure access to a dedicated reviewer account with realistic owned sample data.
5. A real accessible demonstration recording of installation, authorization, evidence, and verification.
6. Reviewer instructions explaining setup, safe test behavior, known constraints, and expected outcomes.
7. Current legal/support URLs and a clear data-use explanation.
8. Private evidence linking the submitted artifact and deployed revision to the acceptance run.

Supply reviewer credentials through the provider's secure form. Keep them out of Git, manifests, videos, issue bodies, and this plan. Never invent a registered app ID or describe proposed scenarios as executed tests.

### Anthropic submission packet

The published plugin process uses GitHub as the source, checks push access, and permits private validation before requiring a public repository for publication. Each plugin folder is its own submission. [Anthropic plugin submission](https://claude.com/docs/plugins/submit)

Prepare the validated `.claude-plugin/plugin.json`, correct component layout, README, license, supported-client statement, and source branch/tag. Confirm the long-term owning organization before the first submission. Account eligibility is not established merely because the CLI is installed.

For the connected launch, prepare the MCP connector's own submission and link it correctly to the plugin. Check the platform support matrix so Claude Code-specific components are not promised on every Claude surface. Own-marketplace publication remains useful while official review proceeds.

### Official MCP Registry packet

Prefer the proposed name `com.fixflags/fixflags`, subject to namespace verification and availability. Use the real HTTPS endpoint and the current remote-server metadata format. The registry supports remote-only servers without an npm package, so the CLI does not have to become a mandatory connection bridge. Each remote URL can belong to only one registry server name; check existing ownership before publication. [Official remote-server publishing guide](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/remote-servers.mdx)

Prepare `server.json`, a stable version, verified namespace ownership, canonical source and documentation links, and the actual authentication requirements. After publication, retrieve the published entry and verify every displayed setup value. Registry publication is metadata distribution, not certification of product correctness.

### Secondary-directory packet

Reuse the approved profile and official registry identity where supported. Recheck whether a listing already exists before creating another. Maintain a compact ledger with directory URL, listing owner, source of imported metadata, update route, last verification, and actual traffic/activation observations.

Do not accept an intermediary's hosting, proxy, or credential-handling arrangement merely to obtain a listing. Evaluate any changed data flow explicitly.

## 12. Connection quality and first use

Prefer native OAuth for interactive clients. Show which account is connected and provide clear revocation. Preserve a developer-key path only where the real client needs it, using the existing protected setup and permissions model. The current MCP authorization specification defines resource metadata and the authorization discovery flow; real clients still need interoperability testing. [MCP authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)

### The first connected session

1. Confirm access with a read-only action.
2. Select the intended Site, using the existing context when unambiguous.
3. Show a specific relevant problem or the current available scope.
4. Ask for or use the already authorized next action.
5. Return links and identifiers that allow the customer or another session to continue.

Do not make the customer choose protocol versions, transports, scope strings, or internal object IDs during ordinary setup. Those details belong in advanced diagnostics and generated client configuration.

### Client-specific shortest paths

These are selected implementation routes to validate, not claims of current FixFlags client acceptance. A published combined plugin replaces separate installation where it provides the shortest reliable path.

| Client/surface | Recommended setup route | What the agent handles | Required human/host step |
| --- | --- | --- | --- |
| Claude Code, local | Reuse an active connection. Otherwise use the accepted native plugin or remote HTTP recipe for the current project context. | Check the matching FixFlags entry, apply the supported recipe, preserve the task, and confirm real access. | Native trust and OAuth, plus activation only if required by that version. |
| Codex CLI, local | Reuse existing access. Otherwise native plugin install when available or the tested `codex mcp` route. | Inspect only the relevant entry, add the connection using an intentional scope, start native login if needed, retain continuation. | Normal command/configuration approval, OAuth, and any required session refresh. |
| Codex desktop/IDE | Use the supported native install or connection surface and shared configuration where applicable. | Offer or perform permitted configuration; preserve the task across activation. | Native install/sign-in and the documented restart when required. |
| Cursor | Native Add to Cursor/plugin install with OAuth; validated local configuration only when needed. | Use the real reviewed install link, reuse existing entry, and continue the task once tools are usable. | Native install and account approval. |
| ChatGPT hosted | The official released FixFlags plugin's native Install/Connect flow. | Provide the actual listing action and continue through supported onboarding. | Install/connect within the account/workspace. Local config edits do not install a hosted plugin. |
| Claude hosted/Cowork | The approved plugin/connector's native directory flow. | Offer the real listing and carry the task where supported. | Native account/workspace installation and sign-in. |
| Lovable or Bolt | Their supported chat connector flow, after direct FixFlags acceptance. | Supply the exact endpoint and OAuth choice; keep the repair/check request. | Add/enable the connector in its native UI unless a documented host API supports this. |
| Other tools | Complete copied evidence or a separately accepted native remote MCP recipe. | Explain the shortest supported action for the actual environment. | Only prerequisites that have been established for that route. |

Lovable's chat connectors are connections used in the builder conversation, distinct from adding integrations to the customer's published app. Bolt documents custom connector setup and project enabling. Keep that boundary clear so an agent does not add FixFlags as an application dependency or expose credentials to the published site. [Lovable chat connectors](https://docs.lovable.dev/integrations/chat-connectors), [Bolt connectors](https://support.bolt.new/integrations/mcp)

Illustrative native remote configuration commands, for recipe authors to test after the service gate opens:

```sh
claude mcp add --transport http --scope local fixflags https://fixflags.com/api/mcp
codex mcp add fixflags --url https://fixflags.com/api/mcp
```

These commands are alternatives for their respective clients. A customer does not run both. Claude's `local` scope is project-associated private configuration; Codex's native add command uses its user configuration by default. Make the scope intentional, preserve the user's existing preference, and use a validated project-config adapter when that is required. Do not describe these two commands as identical project-only writes.

Codex exposes `codex mcp login fixflags` when native OAuth login is needed. Claude has its own supported authentication controls. Invoke only the flow present in the tested host/version; do not spawn a second interactive agent process inside the current chat to imitate a native approval. Use a new session only when required for actual tool activation.

The local help inspection during this revision found Codex CLI `0.155.1` and Claude Code `2.1.278`. Their native setup command shapes were inspected read-only. No MCP entries, plugins, credentials, or settings were added, and help output does not establish live interoperability.

### Read-only confirmation and returning to the task

For a fresh setup, use the real service response to establish authentication and accessible permissions, then read the owned Site or selected Flag appropriate to the task. A zero exit code from an installer or a configuration file on disk is insufficient. An authenticated account with no owned Site is connected, with website setup still outstanding.

If possible, make the first task's read itself confirm access, avoiding a ceremonial extra check. Use connection diagnostics when needed to resolve ambiguity. Do not request a costly website run merely to paint the setup screen green.

Report the correct milestone, then continue:

| Established fact | Appropriate visible state |
| --- | --- |
| Configuration persisted only | Connection saved. Activation or sign-in remains. |
| Host can load the integration | Integration available. Account access may remain. |
| Authorized service read succeeded | Connected to the actual account. |
| Selected Site/Flag read succeeded | Ready for this task. |
| Requested check has a run ID | Check started or resumed. |
| Server returned the completed scoped result | Check complete, with its actual evidence and limits. |

Do not auto-enable an unattended monitor or change the Site's schedule as a setup side effect. Existing monitoring continues according to its own product state.

### Permissions and access design

- Present account-wide versus Site-limited access truthfully. If current keys are account-wide, do not label them Site-scoped.
- Prefer read-only initial access and incremental write consent where the actual provider/client supports it. Document the real limitation if it does not.
- Tie every Site, Flag, run, brief page, and fix attempt to current server-side ownership and lifecycle authority.
- Preserve authorization on continuation requests and after disconnect, account changes, and Site transfer.
- A known public evidence URL never grants private account access.
- A generic public skill must not embed private endpoint state or imply authorization.
- Preserve correct token audience/resource validation, redirect handling, PKCE where required, and credential revocation.
- Keep server-side URL and origin admission, request limits, and protected-action controls.

Review against the MCP security guidance, including token passthrough, confused-deputy risks, SSRF, and authorization URL validation. This supplements the repository's existing security rules; it is not a claim of a new completed security assessment. [MCP security guidance](https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices)

## 13. Operational behavior the integration must get right

### Durable execution

Return a durable run ID promptly, then poll or resume that run. Give clients a bounded retry/backoff contract appropriate to the existing implementation. A connection restart should not create a second check or lose the original scope.

Clearly distinguish admission refusal, queueing, active execution, completion, cancellation, timeout, and unavailable worker capacity. Provide a practical next step for each. Do not mask an execution failure as an empty clean result.

### Repair and recovery

The repair brief's `expectedContextHash` and continuation requests must remain coherent throughout a grouped task. Record an actual described change, keep the returned fix-attempt ID, and request fresh comparable verification. A changed condition, different scope, or incomplete recheck cannot establish recovery for the original problem.

If an agent edits the repository but cannot deploy, the result remains a prepared change. If deployment succeeds but verification is blocked, the result remains deployed and unverified. The website and agent should make these states easy to understand.

### Cost, limits, and control

Use existing run admission and resource limits. Explain expected scope before broad execution. Repeated polling should not create billable runs. Handle retries without multiplying work. Prevent a skill from turning every coding completion into an unbounded scan loop.

The free-beta offer and future paid packaging remain owned by the existing product/billing contracts. Distribution tooling should not create a separate entitlement system.

### Support and diagnostics

Give the user a concise problem description, relevant nonsecret diagnostic identifier, and a specific corrective action. Support materials should distinguish an unsupported client version, blocked network, invalid authorization, no owned Site, unavailable evidence, and worker outage.

Keep private evidence, target URLs, tokens, and raw server errors out of public analytics and screenshots. Use existing structured operational logs with deliberate redaction.

## 14. Acceptance matrix

The current launch gate already calls for a complete owned-Site verification loop, resumption, authorization failures, and evidence integrity. Preserve those requirements and turn them into an executed release matrix.

| Scenario | Required observable result |
| --- | --- |
| Fresh skill install | Correct metadata and instructions load in the advertised client/version. |
| One pasted task, new local user | Follow the accepted setup route, request only native required approvals, and continue the original task without a manual configuration checklist. |
| Repeated setup/task prompt | Reuse the same healthy authorized connection; no duplicate installation or login. |
| Plugin already owns the server | Reuse its server and workflow rather than add a standalone duplicate. |
| Setup permission denied | Preserve the task and explain the exact action needed; do not change approval/security settings. |
| Agent cannot fetch setup instructions | Use complete supplied evidence or an understandable native/self-contained path; no URL-reading loop. |
| Fresh plugin install | Native client finds the intended plugin and loads the expected skill/configuration. |
| Fresh account connection | Secure consent succeeds and only the authorized account is visible. |
| Authorization cancelled | No fake connected state; a clear retry remains available. |
| Existing configuration conflict | Preserve the original entry and settings, explain the conflict, and require an intentional replacement or account switch. |
| Malformed config/duplicate TOML block | Refuse unsafe edits and identify the relevant correction without overwriting unrelated configuration. |
| Config written but tools not active | Report the actual milestone and provide the tested reload/resume step. |
| Installation on a phone or remote environment | Explain where the action can run; do not imply local desktop configuration changes a hosted account. |
| No owned Site | Specific empty state and a useful route to add/save one. |
| Several Sites | Explicit correct selection; no guessed target. |
| Site with no configured Outcomes | Supported Site/category checks and limitations match the actual contract. |
| Scoped check | Returned scope and durable run correspond to the requested Site/category/Outcome. |
| Interrupted session | Resume the same run and obtain its result. |
| Sign-in/reload during setup | Restore the original Site/Flag, task scope, context hash, and any existing run identity. |
| Flag inspection | Exact versioned evidence, affected pages/devices, and full supporting observations. |
| Changed repair context | Refuse stale context and allow a deliberate refresh. |
| Recorded repair | Retain the actual change summary and fix-attempt identity. |
| Fresh comparable verification | Report the server-issued result with scope, freshness, and limitations. |
| Unsupported/caller-certified recovery | Do not close a Flag based on the caller's claim. |
| Cross-tenant/foreign identifiers | Deny access without revealing private data. |
| Insufficient scope/revoked credentials | Fail clearly and require appropriate reauthorization. |
| Arbitrary host/protected action | Preserve target-admission and action authorization boundaries. |
| Rate limit/worker outage | Explain the refusal or delay without duplicate work or fake completion. |
| Blocked target/incomparable evidence | Preserve an unverified state and actionable limitation. |
| Update and uninstall | Predictable upgrade; removal does not erase monitoring or misrepresent remaining service access. |

Run the shared contract suite, then the client-specific differences. Do not infer ChatGPT acceptance from Codex, or Claude web behavior from Claude Code. The compatibility matrix should record version, operating system, install method, auth method, observed result, date, and evidence location.

When implementation reaches this gate, explicitly schedule authorized end-to-end validation. Repository instructions require an explicit user request before browser/E2E work. No such work was run for this research plan. Static and component checks remain the routine implementation checks until that acceptance stage is authorized.

## 15. Search, AI answers, and content distribution

### Technical eligibility

Preserve server-readable content, metadata, canonical links, sitemap coverage, and meaningful internal links. Keep private destinations excluded from indexing while enforcing actual access controls independently.

OpenAI distinguishes its search crawler from its training crawler. Access for `OAI-SearchBot` supports search eligibility; allowing `GPTBot` is a separate choice. Do not frame training access as a requirement for discoverability. Verify edge policy and actual requests separately. [OpenAI crawler documentation](https://developers.openai.com/api/docs/bots)

### Answer useful questions

Develop useful content around actual customer tasks, using the existing six guides before creating more pages:

| Question | Best initial destination | Needed improvement |
| --- | --- | --- |
| How do I check a website built with AI? | Existing monitoring/post-publish guides. | Link the concrete Flag-to-agent workflow. |
| How do I give my coding agent the full problem? | `/docs/fix-with-ai`. | Explain complete evidence, grouped context, and unavailable private links simply. |
| How do I install FixFlags in my tool? | `/agents` and `/docs/agents`. | Selected client, current availability, one correct installation path. |
| How do I know the published fix worked? | Existing post-publish guide and product explanation. | Show a real comparable verification example with limits. |
| Does uptime mean my form works? | Existing online-but-broken and uptime guides. | Use the established distinction and practical examples. |
| What is available in FixFlags today? | Pricing, coverage, and agent destination. | One consistent availability story generated from maintained sources. |

Use concise factual answers that an agent can quote accurately. Explain the audience, prerequisite, next action, and limitation near the relevant claim. Avoid mass-produced editor landing pages and unsupported competitor comparisons.

### Evidence content

Prepare one real, permissioned walkthrough of a broken condition, the retained Flag, the repair, and the subsequent verification. Include an unchanged or inconclusive result where relevant so the demonstration teaches interpretation.

Until real customer permission and evidence exist, use a clearly identified controlled example. Never relabel a fixture as customer proof or infer conversion uplift from a repaired technical condition.

Customer-derived aggregate research continues to use the existing approved, unexpired `GrowthArtifact` publication process. This plan does not authorize publishing customer screenshots, private briefs, domains, prompts, or operational history.

### Distribution beyond directories

Reuse `docs/growth/distribution-kit.md` for educational pilots. The useful teaching unit is the whole repair-and-verification loop, shown in the audience's existing tool. Start with the already researched builder communities and update their rules before any proposal.

No outreach was sent during this research. Messages, sponsorship, paid spend, testimonials, and partnership claims remain separate actions requiring their actual authorization and evidence.

## 16. Patterns to learn from established integrations

These are product-design references, not proof that the same distribution will succeed for FixFlags.

| Reference | Observed pattern | FixFlags application |
| --- | --- | --- |
| Supabase | Its skills guide provides a simple install command, a specific-skill option, update guidance, and a path to combined plugin/MCP setup. | Offer the standalone workflow first and a combined native connection when ready. |
| Stripe | Its MCP guide recommends plugin setup, retains manual client instructions, and explains OAuth and revocation. | Make the preferred path simple while keeping precise advanced setup accessible. |
| Sentry | Its MCP entry describes a clear purpose and gives client-specific setup with optional narrower project context. | Preserve recognizable Site selection and honest permission scope. |

Sources: [Supabase skills](https://supabase.com/docs/guides/ai-tools/ai-skills), [Stripe MCP](https://docs.stripe.com/mcp), [Sentry MCP](https://mcp.sentry.dev/).

The design lesson is a small visible choice backed by reliable details. FixFlags should earn the same ease through its own supported workflow, rather than imitate another company's breadth or claim its integrations.

## 17. Measurement from discovery to retained use

Extend the existing analytics and Site lifecycle reporting. Do not build another attribution database just for plugins.

### Funnel definitions

| Stage | Measure | What it does not establish |
| --- | --- | --- |
| Public discovery | Attributable visits to the agent page or relevant guide. | Unique people or demand without appropriate source evidence. |
| Installation intent | Selected client, copied command, downloaded artifact, or native install click. | Successful installation. |
| Installation | Verified host/package load where observable. | Authorized account access. |
| Connection | Server-observed successful authorized use. | A useful check or customer activation. |
| First useful task | A real owned Site task completed and evidence understood. | Repair success or retention. |
| Repair verification | The exact recorded attempt receives a fresh comparable result. | Business uplift. |
| Continued use | Mature Site monitoring and actual return in the existing 7/28-day cohorts. | Payment or long-term retention beyond the observation window. |

### Proposed event additions

Use a finite vocabulary and existing consent/access rules. Candidate events or typed `marketing_interaction` actions include:

- Agent destination viewed.
- Client selected.
- Task/setup prompt previewed or copied, distinguished from the existing repair-prompt copy event.
- Installation command copied.
- Skill archive downloaded.
- Native install opened.
- Connection authorization started/completed/failed.
- Setup activation blocked or reload required, using finite reason codes.
- Original task resumed after setup, where actually observable.
- First authorized agent task completed.

Prefer existing operational records for authorization, runs, fix attempts, verification, and monitoring. Link only through existing permitted identities and consented attribution. Do not send Site URLs, Flag text, repair prompts, credentials, email addresses, or raw errors to marketing analytics.

A website cannot reliably observe that an external terminal command completed. Keep install intent and verified install distinct. Public asset requests include crawlers and repeated fetches; they are not human downloads or installs.

### Measure the cost of setup itself

Measure from the first task prompt/native entry to the first successful authorized task read and then the requested result. Split active setup time from customer idle time, authentication wait, queue time, and website execution time. Report each separately instead of hiding product delays inside a fast installation statistic.

For each accepted client, record meaningful decisions, app switches, repeated prompts, manual edits, reloads, setup abandonments, and failures to resume the original task. Use observed sessions and available server facts; do not claim the website can see every step in an external agent.

The design target is zero setup for a healthy returning user and one coherent setup handoff for a new user. Investigate every route that asks a customer to copy both a prompt and multiple commands, install redundant packages, or repeat their Site selection. These are product defects to resolve, not numbers to bury in an aggregate conversion rate.

### Channel scorecard

For each release/channel, track the canonical listing URL, version, audience, attributable visits when available, installation evidence, authorized first tasks, mature follow-up, support burden, and incremental operating cost.

Use a 30-day initial learning window where traffic permits. Review small samples as small samples. Missing attribution, consent, credentials, or matured observation time stays unavailable. Set commercial targets after a baseline rather than fabricate conversion forecasts.

### AI answer monitoring

Reuse the existing 24-prompt framework. Record real dated responses, platform/model, citations, and factual review. Include installation and availability questions in a versioned extension of the prompt set.

Assess whether answers explain the right product, point to current installation paths, and distinguish available from planned support. A literal mention count alone misses harmful outdated instructions. Repeated prompts are observations, not independent customers or causal ranking proof.

## 18. Economics and prioritization

A useful channel brings customers who reach the real product result at a support and execution cost we can sustain.

Measure:

- Cost of the initial scoped run, any browser execution, and retained evidence.
- Incremental cost of verification, retries, and scheduled monitoring.
- Support time for installation and authorization failures by client/version.
- Directory preparation and recurring update effort.
- Mature customer value and, when commercial billing is active, properly evidenced paid outcomes.

Do not optimize for installs while hiding duplicated scans, failed first sessions, or expensive support. Keep broad analysis, scoped verification, and monitoring as distinct cost units.

Start with owned website/GitHub distribution and the three named coding clients. Add secondary directories and more adapters when actual qualified usage justifies their maintenance. Official-directory review time should run alongside product work rather than become a forecasted launch date.

## 19. Release, maintenance, and correction

### One release record

For each release, record source commit, package versions, checksums, schema versions, validated clients, deployed website revision, published repository tag, directory states, known limitations, and rollback target.

Track directory states explicitly: draft, submitted, changes requested, approved, published, paused, or retired. Store the actual provider receipt/URL when present. Never convert a local validation pass into a published state.

### Compatibility policy

Declare the minimum tested version for each supported client. Support one primary recommended install path per client, with manual setup as secondary. Recheck when a client changes plugin discovery, authentication, cache behavior, or manifest support.

Treat renamed tools, changed scopes, retired workflows, and package identity changes as migrations. Publish upgrade instructions and preserve compatible URLs where possible. Do not silently change instructions behind an old immutable archive.

### Maintenance cadence

- On every release: verify generated asset parity, manifests, examples, checksums, support links, and current availability.
- After a relevant provider/client change: validate the affected adapter and update its compatibility entry.
- Weekly during launch: review setup failures, support patterns, listing accuracy, and actual first-task completion.
- Monthly once stable: review active channels, stale listings, and the AI answer sample; remove unsupported claims and retire unproductive maintenance.

This is an operating recommendation, not a scheduled automation. No future monitoring was created.

### Rollback and correction

Keep the previous known-good artifacts available. If a release breaks installation or authorization, stop promoting that path, restore the compatible package where supported, and publish clear instructions for affected versions.

Preserve current authorized sessions unless a security issue requires revocation. Withholding a new install must not casually break existing working software. Correct the public source before requesting a directory refresh. Do not assume a Git push clears caches or changes a provider-reviewed listing immediately.

Maintain a correction list for observed stale references, including the current draft-plugin directory entry and npm repository metadata. Check the founder's own public descriptions and selected third-party profiles for retired promises. Record third-party claims as their claims, not verified pricing, usage, or product proof.

## 20. Dependency-ordered execution plan

The effort labels below are relative planning sizes, not delivery promises. Small means a narrow source/copy change, medium means several coordinated surfaces, and large means cross-client or product acceptance work. External review duration is unknown.

### Phase A: Establish a coherent, useful public foundation

| Work package | Concrete deliverable | Owner role | Size | Depends on | Done when |
| --- | --- | --- | --- | --- | --- |
| A1. Define availability and source ownership | Shared distribution profile, task-entry contract, typed client recipe catalog, and source/output map. | Product + integration engineering. | Medium | This plan. | The minimum supported route is explicit for each client/surface; instructions and status have one source. |
| A2. Correct the skill | A focused `fixflags` skill, concise conditional setup clause, and narrowly scoped onboarding helper where supported. | Integration engineering + product copy. | Medium | A1 and current repair contract. | Complete copied-evidence tasks need no setup; missing access follows an honest route and preserves the task. |
| A3. Fix discovery | Compatible indices, canonical skill, generated `/setup.md`, narrow request exception, reading-index links. | Web + integration engineering. | Medium | A1, A2. | Public instructions can be read before installation and do not falsely open connected access. |
| A4. Build public distribution | Allowlisted export, validated skill/plugin bundles, license, release notes, versioned artifacts. | Integration engineering. | Medium | A2, selected schemas. | Deterministic outputs install correctly and contain only intended public files. |
| A5. Add the website entry | Task preview/copy, contextual native action, post-copy/recovery states, `/docs/agents`, and small existing-page links. | Product design + web. | Medium | A1, A3, A4. | A person can hand off one task and understand the next step; no public protocol/configuration choice is required. |
| A6. Publish the owned release | Public kit under the approved GitHub account, owned catalogs, actual release URLs. | Release owner. | Small after validation | A3 to A5, approved release candidate. | Public assets and repository are retrieved at the released version; own-marketplace installs work. |

Phase A can create real value before the connected-service gate opens. Publish only the skill capabilities that actually work. Correct the current publicly indexed draft-package problem as part of A4/A6.

### Phase B: Prove connected use

| Work package | Concrete deliverable | Owner role | Size | Depends on | Done when |
| --- | --- | --- | --- | --- | --- |
| B1. Close product prerequisites | Owned Site/Outcome lifecycle, coherent sign-in/save-site continuation, repair context, verification, and monitoring accepted at a known revision. | Product/runtime owner. | Large, existing work | Current foundation work. | Required product loop and first-time prerequisites work through supported product paths. |
| B2. Resolve adapters and setup behavior | Validated package/native setup recipes, existing-entry reuse, safe merges, intentional scope, truthful CLI milestones, activation and resume contract. | Integration engineering. | Medium to large | A1, A4, actual provider requirements. | Each supported route installs only what it needs and can repeat without duplicate configuration. |
| B3. Accept the complete prompt-to-task journey | Fresh prompt/native entry, login, host activation, selection, correct access, original-task continuation, revoke/reconnect, and interrupted-run resumption. | Product design + integration + security reviewer. | Large | B1, B2. | Behavioral/security matrix and first-time human usability targets pass in the named clients. |
| B4. Release connected access | Evidence-backed discovery-gate change, visible setup, truthful website state, combined bundles. | Product + release owner. | Medium | B3. | A fresh customer can connect and complete the supported task at the deployed revision. |

Do not infer B1/B3 from static inspection of the ongoing working-tree changes. Coordinate with their owner before editing overlapping product, auth, runtime, or repair files.

### Phase C: Publish to the highest-value directories

| Work package | Concrete deliverable | Owner role | Size | Depends on | Done when |
| --- | --- | --- | --- | --- | --- |
| C1. OpenAI packet and submission | Final connected ZIP, identity/domain completion, executed cases, reviewer access/video, actual portal submission. | Publisher + integration owner. | Medium plus unknown review | B3/B4 as required by portal testing. | Provider receipt recorded; publication claimed only after actual approval and publish. |
| C2. Anthropic packet and submissions | Plugin bundle and MCP connector submissions from the intended owning organization. | Publisher + integration owner. | Medium plus unknown review | B3/B4. | Both applicable listing states and actual URLs are known. |
| C3. Official MCP Registry | Verified namespace, correct `server.json`, successful publication, fetched entry. | Integration/release owner. | Small to medium | B4 and namespace control. | The real entry can be retrieved with correct endpoint and metadata. |
| C4. Cursor Marketplace | Validated public source and submission packet. | Integration/release owner. | Medium plus unknown review | Cursor-specific acceptance. | Official listing and a real install are confirmed. |
| C5. Secondary listings | Correct PulseMCP/Smithery/selected directory entries. | Growth owner. | Small per useful channel | Current procedures and B4. | Listing accuracy and attributable qualified use justify maintenance. |

### Phase D: Improve activation and recurring value

| Work package | Concrete deliverable | Owner role | Size | Depends on | Done when |
| --- | --- | --- | --- | --- | --- |
| D1. Instrument the real funnel | Typed intent events plus server-backed connection/task outcomes. | Analytics + product engineering. | Medium | A5; extend for B4. | Funnel stages are distinct, consented where required, and have meaningful denominators. |
| D2. Observe first-time use | Five initial human sessions, returning-user sessions, and supported-client behavioral evaluations, including setup/reload recovery. | Product design + integration owner. | Medium | A5/A6, then repeat on B4. | People reach the task without repeated setup or explanations; time, decisions and failures are recorded. |
| D3. Publish one useful demonstration | Permissioned or explicitly controlled complete repair/verification walkthrough. | Product + growth. | Medium | Demonstrated loop. | Every claim is backed by the actual displayed sequence. |
| D4. Run one educational pilot | A relevant practical session using the existing distribution kit. | Growth owner. | Medium | Explicit outreach authorization and a usable product. | Real feedback and observed available acquisition outcomes are reviewed. |
| D5. Review mature results | Channel scorecard, cost/support analysis, real 7/28-day outcomes, versioned AI-answer observations. | Product + growth. | Medium, recurring | Adequate observation window. | Expansion decisions follow evidence, with unavailable data left explicit. |

### Illustrative sequencing

In the first implementation cycle, complete A1 to A5 and the packaging corrections. Then publish A6 and evaluate the skill path while product owners finish B1. Work on the reviewer packet and identity prerequisites in parallel where they do not require missing live proof. Release connected access after B3, then submit to the relevant directories. Expand only after first-use and support evidence is available.

Prototype and evaluate the prompt, native handoff, and resumed conversation before polishing a large client-selection interface. The connected release is not ready merely because the manual developer setup can be made to work. Its release requirement includes the simple customer path defined in sections 4 to 6.

Do not compress provider reviews or mature retention into an invented one-week launch promise. The critical path is real product/client acceptance, not how quickly manifests can be written.

## 21. Implementation map and focused verification

### Existing sources to extend

| Area | Existing files/modules | Proposed change |
| --- | --- | --- |
| Skill source/delivery | `public/.well-known/skills/`, `scripts/sync-skills.mjs`, `scripts/skill-validator.mjs` | Define one maintained source; generate complete compatible assets and add drift checking. |
| Plugin packaging | `integrations/chatgpt-plugin/`, `scripts/growth/build-chatgpt-plugin.mjs` | Include the skill, use actual format validation, add host adapters and public-only exports. |
| Discovery boundary | `lib/mcp/discoverability.ts`, `proxy.ts`, `scripts/power-tools-visibility-guard.mjs` | Separate public instructions from withheld connected-service entry points. |
| Public navigation | `lib/site/nav.ts`, existing integrations page | Add contextual agent entry without redesigning navigation. |
| New marketing page | Existing marketing page/header/section primitives, `lib/marketing/copy/` | Add `/agents`, task preview/copy and native-action states, with maintained exact copy. |
| Task/setup routing | Existing editor catalog/configuration and proposed `lib/integrations/setup-recipes.ts` | Add capability/availability-aware recipes, exact scope, reuse/conflict handling, activation and continuation. |
| Public bootstrap instructions | Proposed generated `/setup.md`, existing sync/generation scripts | Serve readable current instructions before installation, with only accepted native recipes. |
| Documentation | `lib/docs/catalog.ts`, `lib/docs/generated-blocks.ts`, `content/docs/` | Add `/docs/agents`; generate current availability and tool references where needed. |
| SEO/discovery | `lib/marketing/seo-routes.ts`, `lib/marketing/llms-txt.ts`, metadata/tests | Include the real public destinations and assets with correct indexability. |
| Product handoff | Existing repair-brief contract and MCP registry | Consume current contracts; coordinate with current writer before behavior changes. |
| CLI distribution | `fixflags-cli/package.json`, `src/init.ts`, CLI promotion/registry checks | Correct provenance, detection, safe repeated configuration, and success milestones. Keep the CLI optional. |
| Measurement | Existing consent-aware analytics, Site lifecycle/value reports, AI visibility evaluator | Add finite distribution signals and retain existing provenance rules. |

### Verification by change

- Skill edits: frontmatter/structure validation, reference completeness, tool-contract compatibility, and realistic behavioral scenarios.
- Generated assets: byte parity, index resolution, expected files, checksum validation where used, and nonmutating drift check.
- Packaging: actual schema validation, archive contents, traversal/symlink/secret exclusion, reproducibility, and clean host loading.
- Request-boundary change: public exact-path access plus retained OAuth/MCP withholding, session behavior, security headers, encoded/unexpected paths, and server authorization.
- Website/Docs: focused component checks, correct links and headings, copy rules, indexability/canonical metadata, and no unsupported availability claims.
- Setup UX: prompt-only and native-entry scenarios, safe repeat invocation, connection reuse, missing CLI/permissions, host reload, sign-in cancellation, wrong account, no owned Site, and continuation without a repeated task description.
- Runtime/auth/verification: broader relevant contract and security checks, then authorized end-to-end acceptance at the designated release stage.
- Public launch: retrieve the deployed assets and exact released package, then inspect the real directory entry after publication.

Use the smallest focused checks for each change. Do not run repository-wide verification because unrelated work is dirty. Browser/E2E testing remains subject to the repository's explicit-request rule.

## 22. Definition of complete and remaining decisions

### Foundation is complete when

- A first-time visitor can find and understand the agent offering.
- A copied-prompt user has a useful path without a new connection.
- A person can start with a task prompt and read setup instructions without first installing a skill.
- A supported client can discover and install the published skill.
- Public discovery endpoints and compatibility links work at the released revision.
- Public repository, package contents, license, metadata, and website agree.
- Current draft/schema and CLI provenance issues have an intentional resolution.
- Instrumentation distinguishes intent, installation evidence, connection, and product outcomes.

### Connected distribution is complete when

- The full owned-Site task, repair, and independent verification path passes the acceptance matrix.
- Authorization, revocation, reconnect, missing evidence, and failure states are understandable and correct.
- A healthy returning user has no setup work; a new supported user gets one coherent native setup/sign-in handoff and resumes the original task.
- No ordinary supported route requires manually copying keys, editing JSON, or installing both a redundant CLI bridge and remote connection.
- A required reload is specific to the tested host and preserves the original task context.
- Configuration writes cannot be mistaken for an authorized working connection.
- Every advertised client has dated installation and connection evidence.
- The appropriate official plugin and connector submissions are actually published, or their external review states are explicitly recorded.
- All published listings point to supported installation paths and current claims.
- Upgrade, rollback, support, and maintenance responsibilities have named owners.
- Customer value and distribution costs can be reviewed from real appropriately mature observations.

Completeness means every component has been handled and every external dependency has a known state. It cannot guarantee marketplace acceptance, search placement, recommendation frequency, customer demand, or commercial success.

### Resolve during implementation

| Question | Current position | Resolution |
| --- | --- | --- |
| Public repository owner | User approved connected account `saadbenryane`. | Use the approved account; verify repository name before creation. |
| Canonical skill location | Existing public directory is the current source. | Move source ownership deliberately and migrate generation in one change. |
| Discovery format | Preferred path and installer behavior verified; v0.2 schema host unavailable. | Start from a verified compatible format; validate newer format before adopting it. |
| OpenAI/portable auth config | Published formats currently conflict in the inspected sources. | Validate separate adapters or obtain a documented compatible resolution. |
| Publisher portal access | Not exercised. | Confirm account, organization, role, identity, and domain control in the actual portals. |
| Kit license | Not selected by this research. | Choose an explicit distribution-only license and record its scope. |
| Live product acceptance | Current repository gate remains closed. | Accept the actual integrated/deployed revision with the product owner. |
| Client/version support | No new clean installations performed. | Establish the matrix before advertising compatibility. |
| Default customer entry | Final design selects a task prompt, with a shorter native action where supported. | Implement the selected route rather than expose protocol/package choices. |
| Setup automation scope | Actual local/hosted capabilities differ; native approvals remain required. | Accept one minimum recipe per supported surface and retain the original task through its handoff. |
| Existing third-party listing | Development package already indexed with a warning. | Correct public source and use the actual refresh/correction route. |
| CLI promotion | Published and candidate versions differ; provenance is stale. | Fix metadata and use existing candidate/promotion checks before public recommendations. |
| Secondary directories | Current submission procedures not fully verified. | Recheck only after primary service readiness; avoid premature accounts and listings. |
| Attribution and demand | No new customer metrics collected. | Establish baseline with existing authorized reporting and real releases. |

## 23. Research sources and evidence provenance

Sources were reviewed on October 29, 2026. Platform rules change; recheck the relevant requirements at implementation and submission time. Citations support the specific provider facts above. The recommended strategy, sequence, information architecture, and quality targets are FixFlags planning judgments.

### Primary specifications and platform guidance

1. [Agent Skills specification](https://agentskills.io/specification): skill structure, metadata, and optional resources.
2. [Vercel skills well-known provider](https://github.com/vercel-labs/skills/blob/main/src/providers/wellknown.ts): preferred/fallback discovery paths and accepted index models. Repository-main behavior still needs release-version confirmation before shipping.
3. [skills.sh CLI](https://skills.sh/docs/cli): installation and telemetry behavior.
4. [skills.sh FAQ](https://skills.sh/docs/faq): repository distribution and installation-based leaderboard inclusion.
5. [Agent Plugins specification](https://agent-plugins.org/specification): portable package contract.
6. [Agent Plugins MCP schema 1.0](https://agent-plugins.org/schemas/1.0.0/mcp.schema.json): concrete HTTP-server field restrictions.
7. [OpenAI plugin architecture](https://developers.openai.com/plugins/concepts/plugins): public shared-directory model.
8. [OpenAI package guide](https://developers.openai.com/plugins/build/plugins): manifests, marketplaces, MCP configuration, and compatibility layout.
9. [OpenAI submission guide](https://developers.openai.com/plugins/deploy/submission): publishing identity, ZIP/review workflow, and skills-only/MCP sequencing constraint.
10. [OpenAI MCP review requirements](https://developers.openai.com/plugins/deploy/app-review): connected-service review requirements.
11. [Anthropic marketplace creation](https://code.claude.com/docs/en/plugin-marketplaces): own catalog structure and installation path.
12. [Claude plugin manifest reference](https://code.claude.com/docs/en/plugins-reference): supported metadata and component layout.
13. [Claude Code plugin publication](https://code.claude.com/docs/en/plugins/publish): marketplace versus directory distribution and update behavior.
14. [Anthropic directory publication](https://claude.com/docs/directory/publish): account/role eligibility, ownership, and plugin/connector submission types.
15. [Anthropic plugin submission](https://claude.com/docs/plugins/submit): GitHub source, validation, review, and publication.
16. [Cursor plugins](https://cursor.com/docs/plugins): portable support, installation, and marketplace distinctions.
17. [Cursor plugin reference](https://cursor.com/docs/reference/plugins): public source and submission checklist.
18. [MCP Registry remote-server publication](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/remote-servers.mdx): remote metadata, namespace/URL constraints, and transport.
19. [MCP Registry authentication](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/authentication.mdx): namespace proof mechanisms.
20. [MCP authorization specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization): HTTP authorization and discovery.
21. [MCP security guidance](https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices): authorization and transport-related risks.
22. [OpenAI crawler documentation](https://developers.openai.com/api/docs/bots): search, training, and user-triggered agents.
23. [Google AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide): public-content fundamentals and limits of AI-specific discovery files.
24. [Apple onboarding guidance](https://developer.apple.com/design/human-interface-guidelines/onboarding): contextual learning and minimal prerequisite setup.
25. [Supabase skills](https://supabase.com/docs/guides/ai-tools/ai-skills): standalone and combined installation example.
26. [Stripe MCP](https://docs.stripe.com/mcp): preferred setup, client instructions, authorization, and revocation example.
27. [Sentry MCP](https://mcp.sentry.dev/): focused service explanation and scoped client setup example.
28. [OpenAI MCP setup](https://learn.chatgpt.com/docs/extend/mcp): local versus hosted connection mechanisms and activation requirements.
29. [OpenAI developer commands](https://learn.chatgpt.com/docs/developer-commands): native MCP and plugin management commands.
30. [Claude Code MCP](https://code.claude.com/docs/en/mcp): native remote setup, configuration scopes, authentication and actual connection states.
31. [Cursor MCP](https://cursor.com/docs/mcp): native installation and OAuth support.
32. [Lovable chat connectors](https://docs.lovable.dev/integrations/chat-connectors): connections used in the builder chat versus integrations exposed by the published app.
33. [Bolt connectors](https://support.bolt.new/integrations/mcp): native connector addition and project enabling.

### Direct product/distribution observations

- Public GETs of `https://fixflags.com/robots.txt`, `/llms.txt`, `/integrations`, and `/docs/fix-with-ai`.
- Public GETs returning 404 for the current/preferred skill indices, existing skill, MCP discovery, and protected-resource metadata paths listed in section 2.
- [Official MCP Registry search](https://registry.modelcontextprotocol.io/v0.1/servers?search=fixflags), returned zero matching entries in this observation.
- [Published npm package metadata](https://registry.npmjs.org/fixflags/latest), version 1.0.4 with the historical QewOS repository reference.
- [Indexed development-plugin listing](https://agent-plugins.directory/saadbenryane/fixflags), a third-party observation of the public source and schema warning. The portable schema is the technical authority for that finding.
- GitHub metadata for the existing public `saadbenryane/FixFlags` repository and its draft plugin. The proposed separate kit repository was not found.

### Repository sources inspected

`AGENTS.md`, `CANONICAL-SOURCES.md`, `DEVELOPMENT.md`, `DESIGN.md`, `SECURITY.md`, the current public skill/index and IDE instructions, `proxy.ts`, MCP discoverability and tool registry, repair-brief contract, docs catalog/content and generated blocks, marketing copy/navigation/discovery registries, CLI package metadata, package builder/tests, skill sync/validator/tests, existing growth implementation/distribution/evaluation materials, public discovery verifier, and AI visibility instrumentation.

Existing focused checks executed for this research:

```sh
node --test scripts/growth/build-chatgpt-plugin.test.mjs scripts/skill-validator.test.mjs
```

Result from the initial planning pass: nine tests passed. This final UX revision additionally inspected the existing initializer/setup implementation, official client setup documentation, and read-only installed CLI help/version output. No installers, login commands, plugin mutations, browser or end-to-end tests, live authorizations, submissions, public repository creation, production deployment, outreach, or paid acquisition were performed for this revision. Document structure and changed-file whitespace were checked separately.
