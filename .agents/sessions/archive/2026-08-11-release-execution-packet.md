# 2026-08-11 Release Execution Packet

**Mission:** Operator-facing runbook for executing the FixFlags release gate.
**Scope:** Execute-in-one-sitting unblocking of the 28 missing release inputs
and the release validation flow. No code edits, no deploys, no fixture
provisioning performed here — this packet records environment status and
prescriptive operator actions only.
**Session:** `019ff25a-4207-7b6d-aa64-86a16b2ba775` (crewmate; thinking=unsupported for this model).

---

## Executive summary

| Check | Exit | Result | Notes |
|-------|------|--------|-------|
| Docker daemon (`docker info`) | 0 | HEALTHY | Docker Desktop 29.4.1, 11 containers running, overlay2. Previous metadata-I/O failure appears cleared. |
| Release preflight (`node scripts/release-preflight.mjs`) | 1 | BLOCKED | All 28 designated inputs are UNSET in the current environment. |
| Full local gate (`npm run verify` = `validate.mjs full`) | 0 | PASS | 26/26 commands green. Git tree unchanged before/after. ~6 min wall time. |
| CLI readiness (`npm pack --dry-run` in `fixflags-cli`) | 0 | PASS | Version 1.0.5, 16 files, exit 0. |
| npm registry (`npm view fixflags`) | 0 | `latest=1.0.4`, `beta=1.0.0`, `bootstrap=0.0.0` | Repo version 1.0.5 is not yet published. |

**Release block:** all 28 preflight inputs are missing. Local code gate is green.
The release can proceed once an operator provisions the 28 fixtures and sets
`RELEASE_ALLOW_DATABASE_RESET=true`.

---

## 1. Docker daemon health

Command: `docker info`
Exit code: 0

Daemon state: **healthy**.

- Server Version: 29.4.1
- Storage Driver: overlay2 (io.containerd.snapshotter.v1)
- OS: Docker Desktop (linuxkit), Kernel 6.12.76, aarch64
- Containers: 11 running, 0 paused, 0 stopped
- Images: 13
- Cgroup: v2, Live Restore: false
- Plugins: 13 CLI plugins present
- Insecure Registries: hubproxy.docker.internal:5555, ::1/128, 127.0.0.0/8

**Caveat:** The task notes the daemon had a metadata I/O failure in a prior turn.
The current `docker info` returns healthy (exit 0). No action needed unless a
container build or run subsequently fails. The only Docker command in the verify
gate (`container:build`) completed successfully, producing image
`fixflags:verify` (ID `b931cbba3578`).

---

## 2. Release preflight

Command: `node scripts/release-preflight.mjs`
Exit code: 1 (blocked)

Script logic (`scripts/release-preflight.mjs`):
1. Checks that all 27 env vars in the `required` list are non-empty.
2. Checks that `RELEASE_ALLOW_DATABASE_RESET` equals the literal `"true"`.
3. If any are missing, prints the list and exits 1.
4. If all present, prints `Release preflight passed: disposable database
   consent and sandbox fixtures are present.` and exits 0.

**Missing inputs (28 total, all UNSET):**

```
RELEASE_FRESH_DATABASE_URL
RELEASE_CONTAINER_ENV_FILE
RELEASE_SMOKE_URL
E2E_AUDIT_URL
E2E_SIGNUP_PASSWORD
E2E_2FA_EMAIL
E2E_2FA_PASSWORD
E2E_2FA_BACKUP_CODE
E2E_WEBAUTHN_CREDENTIAL_ID
E2E_WEBAUTHN_PRIVATE_KEY
E2E_WEBAUTHN_USER_HANDLE
E2E_BILLING_FREE_EMAIL
E2E_BILLING_FREE_PASSWORD
E2E_BILLING_PAID_EMAIL
E2E_BILLING_PAID_PASSWORD
E2E_SHARE_OWNER_EMAIL
E2E_SHARE_OWNER_PASSWORD
E2E_SHARE_REPORT_ID
E2E_SHARE_PASSWORD
E2E_WATCH_EMAIL
E2E_WATCH_PASSWORD
E2E_WATCH_PROJECT_ID
E2E_WATCH_MAILBOX_ASSERT_URL
E2E_GITHUB_EMAIL
E2E_GITHUB_PASSWORD
E2E_GITHUB_REPOSITORY
E2E_API_KEY
RELEASE_ALLOW_DATABASE_RESET=true
```

---

## 3. Full local gate — `npm run verify`

Command: `npm run verify` (= `node scripts/validate.mjs full`)
Exit code: 0 (PASS)

**Environment:** `DATABASE_URL=postgresql://fixflags:fixflags@localhost:5432/fixflags`
(loaded from `.env.local`). `REDIS_URL=redis://localhost:6379`.

**No competing processes:** PID 13693 was the sole `npm run verify` process.
No other crew was running build/verify. Git tree confirmed unchanged
before/after (132 modified files before = 132 after, identical set).

**Command sequence (26 commands, all green):**

| # | Label | Command | Result |
|---|-------|---------|--------|
| 1 | db:validate | `npm run db:validate` | PASS |
| 2 | db:check | `npm run db:check` | PASS |
| 3 | db:drift | `npm run db:drift` | PASS (no schema difference) |
| 4 | typecheck | `npx tsc --noEmit --incremental false` | PASS |
| 5 | lint | `npm run lint` | PASS |
| 6 | brand:hex-guard | `npm run brand:hex-guard` | PASS |
| 7 | ui:drift-guard | `npm run ui:drift-guard` | PASS |
| 8 | image:local-patterns-guard | `npm run image:local-patterns-guard` | PASS |
| 9 | image:artwork-guard | `npm run image:artwork-guard` | PASS |
| 10 | product:contract-guard | `npm run product:contract-guard` | PASS |
| 11 | routes:contract-guard | `npm run routes:contract-guard` | PASS |
| 12 | skills:validate | `npm run skills:validate` | PASS |
| 13 | seo:guard | `npm run seo:guard` | PASS |
| 14 | knowledge:duplication-guard | `npm run knowledge:duplication-guard` | PASS |
| 15 | completeness:audit | `npm run completeness:audit` | PASS |
| 16 | mcp:quality-gate | `npm run mcp:quality-gate` | PASS |
| 17 | audit:capabilities | `npm run audit:capabilities` | PASS |
| 18 | security:audit | `npm audit --audit-level=moderate` | PASS |
| 19 | test:scripts | `npm run test:scripts` | PASS (46 script tests) |
| 20 | test:unit | `npm run test:unit` | PASS |
| 21 | test:coverage | `npm run test:coverage` | PASS (72.39% lines) |
| 22 | accuracy:eval | `npm run accuracy:eval` | PASS (0 failures, 104 flags) |
| 23 | test:cli | `npm run test:cli` | PASS (13 CLI tests, 16 files) |
| 24 | build | `node scripts/next-build.mjs` | PASS (Next.js 15.5.21) |
| 25 | worker:build | `npm run worker:build` | PASS |
| 26 | container:build | `docker build -t fixflags:verify .` | PASS |

Notes:
- Test output included expected fixture log lines (e.g., "Error: network down" in
  `Sitemap corridor enrich skipped` info-level log, "lead failed" and "graph
  failed" from audit finalization test fixtures). These are intentional test
  scenarios, not failures. Final counts: `Failures: 0`, `# fail 0`.
- Coverage: 65.09% branches / 71.60% functions / 72.39% lines / 71.01% statements.
- Accuracy: 16 HTML fixtures, 3 gold fixtures, 104 flags, 22 IMPORTANT/CRITICAL,
  0 failures.

---

## 4. CLI readiness — `npm pack --dry-run`

Command: `npm pack --dry-run` (in `fixflags-cli/`)
Exit code: 0

**Package metadata:**
- Name: `fixflags`
- Version: `1.0.5`
- Description: Agent-native FixFlags CLI
- License: MIT
- Engines: node >=22
- Bin: `fixflags` → `./bin/fixflags.js`
- Files in tarball: 16
- Package size: 14.6 kB
- Unpacked size: 56.5 kB
- shasum: `2cbacb222f8dcb737efb066eb84afb44e8a7128d`
- Tarball: `fixflags-1.0.5.tgz`

**Tarball contents (16 files):**
```
LICENSE                              1.1 kB
README.md                            2.8 kB
bin/fixflags.js                       46 B
dist/auth.js                        3.7 kB  + dist/auth.d.ts (915 B)
dist/credentials.js                 7.5 kB  + dist/credentials.d.ts (458 B)
dist/index.js                      17.9 kB  + dist/index.d.ts (31 B)
dist/init.js                        6.8 kB  + dist/init.d.ts (498 B)
dist/mcp-bridge.js                2.5 kB  + dist/mcp-bridge.d.ts (55 B)
dist/workflows.js                 8.9 kB  + dist/workflows.d.ts (2.1 kB)
package.json                        1.3 kB
```

**Registry status (read-only):** `latest=1.0.4`, `beta=1.0.0`, `bootstrap=0.0.0`.
The one-time package claim (bootstrap `0.0.0`) is already done. The repo
version `1.0.5` is not yet published.

**Pre-requisite for publish:** Tag `fixflags-cli-v1.0.5` must exist and match
the package version (enforced by `.github/workflows/publish-cli.yml` Step
"Match tag to package version").

---

## 5. Release validation flow — exact command order

Source: `scripts/validate.mjs` → `releaseCommands()` (lines 277–286).

The release gate (`npm run verify:release` = `validate.mjs release`) runs **9
phases** in this exact order. Each phase must exit 0 before the next starts.

```
Phase 1:  node scripts/release-preflight.mjs
Phase 2:  npm ci                              (clean install from lockfile)
Phase 3:  node scripts/release-database.mjs   (fresh disposable DB: prisma migrate reset)
Phase 4:  [26 full commands — see Section 3]
Phase 5:  npm run test:e2e:release            (E2E_FULL=true E2E_CREDENTIALED=true)
Phase 6:  docker build -t fixflags:release-check .
Phase 7:  node scripts/container-smoke.mjs    (container topology + audit completion)
Phase 8:  npm run smoke:release               (scripts/release-smoke.mjs → deployed)
```

**Phase 3 constraint (scripts/release-database.mjs):**
- `RELEASE_FRESH_DATABASE_URL` must be set.
- `RELEASE_ALLOW_DATABASE_RESET` must equal `"true"`.
- The release DB URL must **not equal** `DATABASE_URL`.
- The database name (from the URL pathname) must match `/(?:release|test)/`.
- Runs `npx prisma migrate reset --force --skip-seed` against that URL.
- This is a **destructive, irreversible** wipe of the designated release database.

**Phase 5 constraint (e2e/credentialed-journeys.spec.ts):**
- Tests only run when `E2E_CREDENTIALED=true` AND `RELEASE_FRESH_DATABASE_URL`
  is set AND `RELEASE_ALLOW_DATABASE_RESET === "true"`.
- Without these, all 6 credentialed tests skip with a reason.
- `E2E_CREDENTIALED` is set by `npm run test:e2e:release` (package.json line 38):
  `E2E_FULL=true E2E_CREDENTIALED=true playwright test`.

**Phase 7 (scripts/container-smoke.mjs):**
- Requires `RELEASE_CONTAINER_ENV_FILE` to exist on disk.
- Spins up Postgres 16, Redis 7, a web container, and a dedicated worker
  container on an ephemeral Docker network.
- Runs a full audit end-to-end inside the container stack.

**Phase 8 (scripts/release-smoke.mjs):**
- Requires `RELEASE_SMOKE_URL` (the deployed release URL).
- Probes `/api/health/ready`, `/api/health/browser`, `/api/health/ai?validate=1`,
  then runs route-boundary smoke across all public routes.

**Note:** `npm run agent -- verify --full` runs only `fullCommands()` (Phase 4 +
container:build if container validation files changed). It does **not** run the
release-specific phases (preflight, ci, fresh-db, e2e, container-smoke,
deployed-smoke). The full release gate is `npm run verify:release`.

---

## 6. Environment status per release input

All 28 inputs are **UNSET** in the current shell environment and in
`.env.local`.

| Input | Status | Current value |
|-------|--------|---------------|
| `RELEASE_FRESH_DATABASE_URL` | MISSING | (none) |
| `RELEASE_CONTAINER_ENV_FILE` | MISSING | (none) |
| `RELEASE_SMOKE_URL` | MISSING | (none) |
| `E2E_AUDIT_URL` | MISSING | (none) |
| `E2E_SIGNUP_PASSWORD` | MISSING | (none) |
| `E2E_2FA_EMAIL` | MISSING | (none) |
| `E2E_2FA_PASSWORD` | MISSING | (none) |
| `E2E_2FA_BACKUP_CODE` | MISSING | (none) |
| `E2E_WEBAUTHN_CREDENTIAL_ID` | MISSING | (none) |
| `E2E_WEBAUTHN_PRIVATE_KEY` | MISSING | (none) |
| `E2E_WEBAUTHN_USER_HANDLE` | MISSING | (none) |
| `E2E_BILLING_FREE_EMAIL` | MISSING | (none) |
| `E2E_BILLING_FREE_PASSWORD` | MISSING | (none) |
| `E2E_BILLING_PAID_EMAIL` | MISSING | (none) |
| `E2E_BILLING_PAID_PASSWORD` | MISSING | (none) |
| `E2E_SHARE_OWNER_EMAIL` | MISSING | (none) |
| `E2E_SHARE_OWNER_PASSWORD` | MISSING | (none) |
| `E2E_SHARE_REPORT_ID` | MISSING | (none) |
| `E2E_SHARE_PASSWORD` | MISSING | (none) |
| `E2E_WATCH_EMAIL` | MISSING | (none) |
| `E2E_WATCH_PASSWORD` | MISSING | (none) |
| `E2E_WATCH_PROJECT_ID` | MISSING | (none) |
| `E2E_WATCH_MAILBOX_ASSERT_URL` | MISSING | (none) |
| `E2E_GITHUB_EMAIL` | MISSING | (none) |
| `E2E_GITHUB_PASSWORD` | MISSING | (none) |
| `E2E_GITHUB_REPOSITORY` | MISSING | (none) |
| `E2E_API_KEY` | MISSING | (none) |
| `RELEASE_ALLOW_DATABASE_RESET` | MISSING | (must be `"true"`) |

`.env.local` currently contains only: `DATABASE_URL`, `REDIS_URL`,
`OPEN_CODE_API_KEY`, `OPENAI_API_KEY`.

---

## 7. What each missing fixture is for

### Release-infrastructure inputs (4)

**`RELEASE_FRESH_DATABASE_URL`** — A dedicated PostgreSQL database URL for the
fresh-migration release gate (Phase 3). The script
(`scripts/release-database.mjs`) runs `prisma migrate reset --force` against it,
wiping it completely. It must differ from `DATABASE_URL` and the database name
must contain "release" or "test" (safety guard). This gives the release gate a
clean-slate database to migrate and test against — no leftover rows from prior
runs.

**`RELEASE_CONTAINER_ENV_FILE`** — Filesystem path to a `.env` file containing
production-like environment variables for the container smoke test (Phase 7,
`scripts/container-smoke.mjs`). The script passes it via `--env-file` to the
Docker web and worker containers. Must exist on disk. Contains secrets like
`OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `BETTER_AUTH_SECRET`, etc. at
production-like values. The container stack runs Postgres 16 + Redis 7 + Next.js
web + dedicated worker.

**`RELEASE_SMOKE_URL`** — The URL of the deployed release instance (Phase 8,
`scripts/release-smoke.mjs`). The script probes health endpoints and runs
route-boundary smoke tests against this URL. Typically the staging or
deployed release URL (e.g., `https://fixflags.com` or a staging subdomain).
Can also be set as `RELEASE_SMOKE_BEARER` for authenticated probes.

**`RELEASE_ALLOW_DATABASE_RESET=true`** — Boolean consent flag. Must be the
literal string `"true"`. Required by three places:
1. `release-preflight.mjs` — gates preflight pass.
2. `release-database.mjs` — gates the destructive ` prisma migrate reset`.
3. `credentialed-journeys.spec.ts` — gates whether credentialed e2e tests run
   at all (must also have `E2E_CREDENTIALED=true` and
   `RELEASE_FRESH_DATABASE_URL` set).

### Credentialed e2e journey inputs (24)

All consumed by `e2e/credentialed-journeys.spec.ts` (6 test cases, each a
revenue-critical customer journey). These require `E2E_CREDENTIALED=true`
(which `npm run test:e2e:release` sets automatically).

**`E2E_AUDIT_URL`** — The target website URL to review. Used in the
anonymous-claim signup test (test 1), the MCP CLI test (test 6), and shared
across multiple journeys. Must be a URL that FixFlags can successfully audit.

**`E2E_SIGNUP_PASSWORD`** — Password for the ephemeral account created during
the anonymous-claim signup flow test (test 1). The test submits an audit as an
anonymous user, then signs up with this password to unlock fix prompts and
verify the claim flow.

**`E2E_2FA_EMAIL`, `E2E_2FA_PASSWORD`** — Email and password for a sandbox
account with 2FA enabled via passkey (test 2). The test registers a virtual
WebAuthn authenticator and verifies passkey sign-in.

**`E2E_2FA_BACKUP_CODE`** — A backup code for the 2FA test account, used to
verify the backup-code recovery flow (test 2, second half).

**`E2E_WEBAUTHN_CREDENTIAL_ID`, `E2E_WEBAUTHN_PRIVATE_KEY`,
`E2E_WEBAUTHN_USER_HANDLE`** — WebAuthn credential parameters for the virtual
authenticator used in the passkey sign-in test (test 2). The test uses
Playwright CDP to add a virtual authenticator with these credentials.

**`E2E_BILLING_FREE_EMAIL`, `E2E_BILLING_FREE_PASSWORD`** — Sandbox Free-tier
account credentials (test 3). The test verifies Stripe checkout can be initiated
from a free account (POST `/api/stripe/checkout` with `{plan: "BUILDER"}`) and
the redirect URL matches `checkout.stripe.com`.

**`E2E_BILLING_PAID_EMAIL`, `E2E_BILLING_PAID_PASSWORD`** — Sandbox Paid/Pro
account credentials (test 3). The test verifies the Stripe billing portal can
be accessed (POST `/api/stripe/portal`) and the redirect URL matches
`billing.stripe.com`.

**`E2E_SHARE_OWNER_EMAIL`, `E2E_SHARE_OWNER_PASSWORD`** — Sandbox account that
owns a report (test 4). The test uses this account to create a password-protected
share link and then test view counting, revocation, and access denial.

**`E2E_SHARE_REPORT_ID`** — The report ID owned by the share-owner account
(test 4). The test creates a share link on this report, then verifies view
counting (expects exactly 1 view), revocation, and denial after revoke.

**`E2E_SHARE_PASSWORD`** — Password to protect the share link (test 4). The
test creates a share link with this password and verifies a viewer can access
it only with the correct password.

**`E2E_WATCH_EMAIL`, `E2E_WATCH_PASSWORD`** — Sandbox account with Product Watch
enabled (test 5). The test verifies the Watch scheduling and notification flow.

**`E2E_WATCH_PROJECT_ID`** — Project ID whose Watch interval is modified (test 5).
The test updates the watch interval to "weekly" and polls until
`watchLastRunAt` changes.

**`E2E_WATCH_MAILBOX_ASSERT_URL`** — URL of a disposable mailbox API (test 5).
The test polls this URL and asserts `matchingMessages === 1` (exactly one email
sent by the watch run). Must be a URL that returns JSON with a
`{ matchingMessages: number }` field. An optional `E2E_WATCH_MAILBOX_TOKEN`
env var provides bearer auth if needed.

**`E2E_GITHUB_EMAIL`, `E2E_GITHUB_PASSWORD`** — Sandbox account credentials
connected to GitHub (test 6). The test uses these to authenticate to the
FixFlags app which then performs a GitHub repository scan.

**`E2E_GITHUB_REPOSITORY`** — GitHub repository in `owner/repo` format (test 6).
The test starts a repo scan, waits for completion, finds a fixable finding, and
creates a fix PR. The repository must contain at least one fixable finding
(asserted in the test).

**`E2E_API_KEY`** — A FixFlags API key with MCP access (test 6). The test uses
this to call MCP tools: `ff_check_and_plan`, `ff_get_check_status`,
`ff_get_report`, `ff_get_all_fixes`, and `ff_recheck_and_compare`. The MCP endpoint
defaults to `${E2E_BASE_URL}/api/mcp` (or `E2E_MCP_URL` if set).

### Billing-gate spec (separate, opt-in)

`e2e/billing-gate.spec.ts` is a **separate** opt-in spec that only runs when
`E2E_BILLING_GATE=true` is set. It is NOT part of the standard
`test:e2e` or `test:e2e:release` suites. It requires its own set of env vars
documented in the spec header (lines 40–48): `E2E_BASE_URL`,
`E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `E2E_GATE_MEMBER_RELEASED_*`,
`E2E_GATE_MEMBER_BLOCKED_*`, `E2E_GATE_NON_MEMBER_*`, and optionally
`E2E_STRIPE_SECRET_KEY`, `E2E_PAID_OPEN_EXPECTED`. This spec is
**BLOCKED** in the current session — no test-mode Stripe app/env exists. It does
not block the release gate because `RELEASE_ALLOW_DATABASE_RESET` is not in its
env list; it self-skips.

### Known pre-existing e2e issue (documented in launch-checklist.md)

The workspace has a version mismatch: `package.json` pins
`playwright@^1.62.0` (bin at 1.62.0) while `@playwright/test@^1.61.1` is
installed. This causes ALL e2e specs to fail with
"did not expect test.describe()/test.use() to be called here." This affects
pre-existing `public-journeys.spec.ts` and `credentialed-journeys.spec.ts` too.
The operator must resolve this (align versions: `npm i -D @playwright/test@1.62.0`
or `npm i -D playwright@1.61.1`) before Phase 5 e2e tests can run. This is a
pre-existing issue, not introduced by the current working-tree changes.

---

## 8. Operator action items — unblocking in one sitting

### Step A — Provision the release database (input #1, #28)

1. Create a fresh PostgreSQL database with a name containing "release" or "test"
   (e.g., `fixflags_release`).
2. Set `RELEASE_FRESH_DATABASE_URL` to its connection string
   (e.g., `postgresql://fixflags:fixflags@localhost:5432/fixflags_release`).
3. Set `RELEASE_ALLOW_DATABASE_RESET=true`.
4. This must differ from the existing `DATABASE_URL`
   (`postgresql://fixflags:fixflags@localhost:5432/fixflags`).

### Step B — Provision the container env file (input #2)

1. Create a `.env` file at a known path (e.g., `.env.release-container`).
2. Populate with production-like values: `DATABASE_URL`, `REDIS_URL`,
   `BETTER_AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, `OPENAI_API_KEY`,
   `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PAID_OPEN`,
   `NEXT_PUBLIC_PAID_OPEN`, `TOKEN_ENCRYPTION_KEY`, etc.
3. Set `RELEASE_CONTAINER_ENV_FILE` to the file path.

### Step C — Provide the deployed smoke URL (input #3)

1. Deploy the current tree to a staging/release URL.
2. Set `RELEASE_SMOKE_URL` to that URL
   (e.g., `https://fixflags-staging.up.railway.app`).
3. Optionally set `RELEASE_SMOKE_BEARER` if health endpoints require auth.

### Step D — Provision sandbox accounts and inputs (inputs #4–#27)

For each input in Section 7, provision the corresponding sandbox fixture:

1. **`E2E_AUDIT_URL`** — A live website URL that FixFlags can audit.
2. **`E2E_SIGNUP_PASSWORD`** — A test password for ephemeral signup.
3. **`E2E_2FA_*`** (4 vars) — A sandbox account with 2FA enabled; generate
   WebAuthn credential via Playwright CDP (credential ID, private key, user
   handle) + backup code.
4. **`E2E_BILLING_FREE_*`**, **`E2E_BILLING_PAID_*`** (4 vars) — Sandbox Free
   and Paid accounts with Stripe test-mode subscriptions.
5. **`E2E_SHARE_*`** (4 vars) — A sandbox account that owns a report; use its
   report ID.
6. **`E2E_WATCH_*`** (4 vars) — A sandbox account with Product Watch on a
   project; provide a mailbox assertion URL (e.g., Mailinator/Ethereal API).
7. **`E2E_GITHUB_*`** (3 vars) — A sandbox account connected to GitHub;
   provide a test repository with a fixable finding.
8. **`E2E_API_KEY`** — A FixFlags API key with MCP access.

### Step E — Fix the Playwright version mismatch

```bash
npm i -D @playwright/test@1.62.0  # OR: npm i -D playwright@1.61.1
```

### Step F — Resolve version bump

1. Bump `fixflags-cli/package.json` from `1.0.5` to a new immutable version
   (e.g., `1.0.6`).
2. Bump `package.json` `version` to match (currently `0.1.0` — confirm this is
   the app version, not CLI version).
3. Commit all changes.
4. Create and push tag `fixflags-cli-v<new-version>`.
5. The `publish-cli.yml` workflow verifies, builds, and publishes via OIDC
   trusted publishing.

### Step G — Run the release gate

```bash
# After all env vars are set and committed:
npm run verify:release
# Or: npm run agent -- verify --full  (runs fullCommands only, skip release-specific phases)
```

### Step H — Post-publish verification

1. Confirm `/api/cli/release` returns `"available": true`.
2. Install from npm: `npm install --global fixflags@beta`.
3. Run the dogfood journey:
   ```bash
   fixflags login
   fixflags init https://fixflags.com
   fixflags check https://fixflags.com --wait --plan
   fixflags recheck <original-report-id> --wait --diff
   ```
4. Verify CLI report IDs, flag counts, ranking, and Finish Plan match the web
   report.

---

## 9. CLI release prerequisites reference

From `docs/cli-release.md` and `.github/workflows/publish-cli.yml`:

- **Package name:** `fixflags` (scoped: none).
- **Current repo version:** 1.0.5 (not yet published).
- **Registry `latest`:** 1.0.4.
- **Bootstrap tag:** 0.0.0 (one-time package claim already done).
- **Publish workflow:** `publish-cli.yml` triggers on tag `fixflags-cli-v*`.
- **Trusted publishing:** Configured (GitHub OIDC, `npm` environment,
  requires `id-token: write`).
- **Tag matching:** Workflow asserts `fixflags-cli-v${version}` === `GITHUB_REF_NAME`.
- **Pre-publish checks:** Cross-platform test (Node 22 on ubuntu/macos/windows),
  `npm test`, `npm run package:check` (16 files), clean-install packed CLI
  (`scripts/verify-cli-package.mjs`).
- **Dist-tags:** `beta` for prereleases, `latest` for stable.

**Do NOT reuse a published version or move `latest` to an unverified build.**

---

## 10. Verification commands (operator copy-paste)

```bash
# 1. Docker daemon
docker info; echo "exit=$?"

# 2. Release preflight
node scripts/release-preflight.mjs; echo "exit=$?"

# 3. Full local gate
npm run verify; echo "exit=$?"

# 4. CLI readiness
cd fixflags-cli && npm pack --dry-run; echo "exit=$?"

# 5. (After provisioning) Release gate
npm run verify:release; echo "exit=$?"
```
