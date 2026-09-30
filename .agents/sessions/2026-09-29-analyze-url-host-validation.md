# Analyze URL host validation

Owner: codex-01a0ec19. Status: locally verified; not released or customer-validated.

## Customer failure

The shared Analyze form rejected `https://example.com/docs/localhost` before it sent a request. It searched the entire URL string for `localhost`, even though the parsed destination hostname is `example.com`. A red-before-green rendered form test reproduced zero scan handoff calls and the public-access error.

## Change and proof

`AuditInput` now checks the parsed hostname for known local hosts. The server's broader URL and DNS validation remains authoritative before queueing. The focused form suite passed 18/18. An isolated local Next `/new` browser walk at 375 px intercepted `/api/checks` before creation: entering `https://example.com/docs/localhost` sent one POST carrying that URL and no local-host error; entering `https://app.localhost/example.com` sent zero POSTs and displayed the public-access error. The intercepted request did not create a scan or prove that the example path exists.

`npm run agent -- verify --dry-run` selected the full 30-command suite because another owner's `package.json` is changing. Scoped ESLint, `ui:drift-guard`, `skills:validate`, `git diff --check`, and nonincremental `npx tsc --noEmit --incremental false` passed after Wave 1 landed. Full shared gates remain to be checked. The concurrent JEV working-tree changes are outside this scope. No deployment or customer-use evidence is claimed.
