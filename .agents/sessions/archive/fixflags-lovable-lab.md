# FixFlags Lovable Lab

Internal harness: one long-lived fake-business site on Lovable, used to benchmark and improve FixFlags.

## Goal

Not “ship a startup.”  
**Same lab product + versioned checkpoints → run FixFlags → adjudicate → fix FixFlags (or real site bugs) → restore old checkpoint via Git → re-benchmark.**

## Lean stack

| Piece | Choice |
|-------|--------|
| Lab app | One Lovable project (fake local business) |
| Code / checkpoints | Private GitHub repo, **sibling** of FixFlags: `~/Code/fixflags-lab-01` |
| Prompt Lovable | MCP `https://mcp.lovable.dev` via **pi-mcp-client** extension (HTTP + token) |
| Agent host | Pi + `~/.pi/agent/extensions/pi-mcp-client` (OAuth browser flow still TODO; Lovable allowlist may block) |
| Reviews | FixFlags against Lovable preview/deploy URL |
| Restore | Git tags/branches on **synced** branch → Lovable two-way sync → redeploy → FixFlags |
| Docs/logs | This file + short run rows below (no nested repo in `qewos`) |

Do **not** nest the lab repo inside `qewos`.

## Loop (every run)

1. Ensure lab URL is live (deploy if needed).
2. Optionally restore checkpoint: checkout tag/branch on synced Git branch → wait Lovable sync → redeploy.
3. Run FixFlags product review (or update review).
4. Adjudicate top findings: `true` / `fp` / `dupe` / `weak-prompt`.
5. **FP or bogus** → root-cause in FixFlags → patch + test → re-run same URL until clean.
6. **True issue** → optional Lovable fix via MCP (only if it helps the lab); prefer FixFlags learning.
7. Tag checkpoint if useful (`bench-YYYY-MM-DD`, `lab-latest`).
8. Log one line in Run log. Durable FixFlags facts → `.agents/learnings/` or fixtures.

## Checkpoints (Git is source of truth)

- Lovable ↔ GitHub is **two-way on one active branch** (usually `main`).
- Freeze: `git tag bench-…` on known-good commit.
- Time-travel: switch Lovable active branch to `bench/…` **or** revert-forward on `main` (prefer branch switch; avoid force-push wars).
- After code matches checkpoint: **deploy again**, then FixFlags.
- Return to tip: switch back to `main` / `lab-latest`.

## Autonomy split

| Who | Does |
|-----|------|
| Operator (once) | Lab Lovable account, MCP OAuth, GitHub app link, clone path, credit budget, permissions |
| Agent (ongoing) | Business scenario, Lovable prompts, FixFlags runs, adjudication, FixFlags fixes, tags, logs |
| Still semi-manual if needed | First MCP OAuth; Lovable UI if sync/MCP breaks; credit top-up |

## Out of scope (lean)

- Multiple lab products at once  
- Nested git in FixFlags  
- Optimizing only for Lovable forever (lab is one generator)  
- Real users, real payments, prod secrets in lab app  

## Implementation phases

### P0 — Access (blocked on operator)
- [ ] Lovable lab workspace + MCP OAuth on Cursor/Claude Code  
- [ ] GitHub repo created by Lovable link (or connected)  
- [ ] Sibling clone on this machine  
- [ ] Smoke: `list_projects` / `send_message` / deploy URL / `git pull` sees bot commits  

### P1 — First baseline
- [ ] Define one fake business + first build prompt  
- [ ] Deploy stable URL  
- [ ] Tag `bench-v0`  
- [ ] First FixFlags review + adjudication saved  

### P2 — Operating cadence
- [ ] FP → FixFlags fix → retest same bench  
- [ ] True fix path once (prompt → Lovable → update review)  
- [ ] One full restore-from-tag → re-benchmark drill  

### P3 — Only if repeating
- Thin script or skill: “run lab review + append log” (no platform bloat)

## Run log

| Date | Checkpoint | FixFlags report | Result (counts) | FixFlags change | Notes |
|------|------------|-----------------|-----------------|-----------------|-------|
| | | | | | |

## Credentials checklist

See end of conversation / operator packet: Lovable MCP OAuth, GitHub clone access, FixFlags local env. No passwords in git.
