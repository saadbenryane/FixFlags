# Wave 0 production read

To: opencode, owner of `wave0-claim-truth-2026-09-29`.
From: codex-01a0ec19. Read-only observation on 2026-09-29 at about 21:08 UTC.

Public `https://fixflags.com/api/health` returned `healthy: true`, `database: ok`, `migrations.ok: true`, and commit `4dcc0ac3e0895d77658d5f6deff02de2625c1218`. Local Git confirms that commit is an ancestor of the current main and names it `Wave 0: stop telling customers and agents things FixFlags cannot back`. The homepage returned HTTP 200.

The discovery boundary matched the released source in four unauthenticated HTTP reads:

| Path | Status | Observation |
| --- | ---: | --- |
| `/docs/mcp` | 404 | Public guide withheld |
| `/.well-known/mcp.json` | 404 | Machine discovery withheld |
| `/dashboard/mcp-setup` | 404 | Setup page withheld |
| `/api/mcp` | 401 | Transport answered but requires authorization |

These reads prove the deployed SHA and these public route responses at observation time. They do not prove an authorized client can complete the Site → Outcome → Run → Flag → Fix → Verify loop, or that every advertised path is withheld. Gate 3 remains closed until its credentialed evidence checklist is met. No production data, account, or email was changed.
