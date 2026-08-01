# Report workspace interface

**Status:** Approved interface spec (August 2026). Engineering and design source for report workspace chrome.

**Canonical for:** layout regions, view modes, browser modes, playback strip, mobile behavior, and on-screen terminology.

**Related:** Product requirements live in [product-prd.md](./product-prd.md). Visual tokens and component rules live in [DESIGN.md](../DESIGN.md). When this workspace ships, report section order and anchors in [knowledge/report-contract.md](../knowledge/report-contract.md) follow this spec (Funnel anchor: `report-funnel`).

**Implementation:** Evolve [ReportWorkspaceShell](../components/report/ReportWorkspaceShell.tsx) and progressive report parity. Do not fork a second report app.

---

## Layout regions (desktop)

| Region | Purpose |
|--------|---------|
| **Left — Chat** | Persistent conversation with FixFlags: steering, Flag Q&A, “what to fix first”, lightweight product corrections. Activity stream may live here or above chat. Chat uses a cheap router model, not the judge pipeline. |
| **Right — Browser** | Dominant panel. User toggles **Browser view** vs **Report view** in the same workspace (not a separate route). |
| **Bottom — Playback** | Timeline/scrub strip for path replay and step evidence. Syncs with the browser when a path or Flag evidence is selected. FullStory-style scrub for deep review; step markers for product review. |

```mermaid
flowchart TB
  subgraph workspace [ReportWorkspace]
    Chat[Left_Chat]
    subgraph right [Right_Toggle]
      BrowserView[BrowserView]
      ReportView[ReportView]
    end
    Playback[Bottom_Playback]
  end
  Chat --- right
  right --- Playback
```

---

## View modes (right panel toggle)

### Browser view

Shows the product as FixFlags experienced it.

**Product review mode** — programmatic capture. Playwright-driven browser with screenshot-forward evidence (today’s pipeline). User sees live or stepped captures aligned to checks; not full agent autonomy.

**Deep review mode** — agent-class browser. Autonomous navigation and interaction comparable to power-user browsing (multi-step journeys, funnel traversal, path recording). Public marketing explains this as agent-level browser exploration without naming competitors as endorsement.

### Report view

Today’s Finish Plan surfaces: progress band, Fix list, Flag detail, Funnel, Contract, previews, update review affordances. Same review record; switching views does not lose context.

---

## Morph behavior

| Phase | Default right panel | Chrome |
|-------|---------------------|--------|
| **Active review** | Browser view (dominant) | Chat left; playback bottom when steps exist |
| **After complete** | Report view for triage | User can switch back to Browser view for replay and evidence |

---

## Funnel, paths, and playback

- **Funnel** — journeys listed inside the report map (same report, not a separate product area).
- **Path** — opens from Funnel or Flag evidence; full session-style replay in the browser panel with scrub timeline and evidence continuity.
- **Playback strip** — bottom of workspace; proves the finding without imagination. Target is replay-grade scrub in-product, not static screenshot galleries only.

---

## Update review

- **Update review** is a primary header action on completed reports (owner).
- **Compare** is the Pro payoff: before/after proof after update review; diff strip (cleared / remaining / new) on child reports.
- Customer term: **Update review** (not re-check). Internal route `/re-check` may remain until API migration.

---

## Chat policy

- Chat always available in the left panel (live, completed, update review context).
- Scope: explain Flags, steer review, ask what to fix first, lightweight corrections to product understanding. Not a general coding agent.
- **Model:** cheapest viable chat model on OpenRouter (or equivalent router). Product judgment and Flags stay on the audit/judge pipeline.
- Requirements: separate chat model config from judge/triage; hard cap or rate limit per session/plan; degrade to canned actions (“Explain this Flag”) if provider unavailable.

---

## Mobile

Full parity. No degraded subset.

| Capability | Requirement |
|------------|-------------|
| Start product review | Yes |
| Watch progress / activity | Yes |
| Chat with FixFlags | Yes |
| Browse Fix list and Flag detail | Yes |
| View evidence and path replay | Adapted layout |
| Run update review and see diff | Yes |
| Account, billing, usage meters | Yes |

**Primary switch:** Lovable-style **Chat ↔ Product** (tabs or bottom bar). Report view accessible without stripped features.

**Playback on small screens:** bottom strip or full-screen takeover — layout choice is open (see [product-prd.md](./product-prd.md) open questions).

**Patterns (reference, not clone):** device toggle above preview on desktop; live preview stays central; 44px targets; “Open on phone” / share preview link for testing captured URL on device.

---

## Customer labels on chrome

Wire from [lib/marketing/copy/terminology.ts](../lib/marketing/copy/terminology.ts):

| Label | Use on chrome |
|-------|----------------|
| Product review | Standard full pass |
| Deep review | Journey + funnel + path mode |
| Update review | Re-run on same URL (header CTA) |
| Funnel | Report section |
| Path | Playback unit |
| Fix list | Ranked work queue |

Do not show **re-check** in customer UI.

---

## Shipped vs target (interface)

| Area | Today | Target |
|------|-------|--------|
| Layout | Report-first single column | Split during live; report chrome after complete |
| Browser | Screenshots in Flag detail | Live + replay in right panel |
| Chat | MCP/CLI only | In-app left panel (cheap model) |
| Funnel | Section title + journey list | + path replay in browser panel |
| Mobile | Responsive report | Full-featured Chat ↔ Product parity |
| View toggle | Report only | Browser view ↔ Report view |

---

## Open design questions

1. Chat ↔ Product on mobile: bottom tabs vs swipe vs FAB drawer?
2. Path replay: inline in report vs full-screen takeover on small screens?
3. Deep review teaser on Free: one journey playback vs summary-only?
4. Takeover (user controls browser): first release or follow-on?

Do not block workspace scaffold on these answers.
