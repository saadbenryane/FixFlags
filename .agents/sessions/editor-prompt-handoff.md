# Editor prompt handoff

Copied Flag and Finish Plan prompts are a live-page observation handoff: page, viewport, section, current text, task body, then search, short plan, and implement only that plan.

Prescription writes a task body only. Invented file paths are stripped at copy time. `evidenceTargets` travel the report read path so the search key can use a measured selector and node text.

## Proof

- Focused unit tests for handoff, Finish Plan, explorer, MCP, prescription, and evidence targets.
- `npm run agent -- verify` passed (14 affected commands).
- `/samples` SSR payload includes the Finish Plan bundle (Page, Viewport, document head, Current H1 quote, Task, search-then-plan) with zero `## Goal` and zero `app/page.tsx`.
- Anonymous live report `/report/cmtaddaze000bgumgxkpk4gjj` keeps Copy prompt chrome and omits the prompt body (`Task:` / finding lead count 0).
- Component tests: owner Copy writes the assembled string; locked Copy opens create-account and does not write the clipboard.

Live click-copy in this environment could not be exercised: the local Next server returned 404 for `/_next/static` chunks, so client handlers did not attach.
