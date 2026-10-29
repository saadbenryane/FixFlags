# Production runtime configuration

`railway.ts` manages the production web and audit worker through the named
`fixflags-runtime` partial. Databases, Redis, volumes and buckets retain their
existing ownership. The isolated validation services already use explicit
platform settings and bounded manual deployment controls.

Install the pinned development SDK with `npm ci`. Run the Railway CLI directly
from the repository root and link the intended project and environment:

```sh
railway link --project c7d6f183-1385-4803-b2db-94eb663eb147 --environment production
railway config plan
```

Every existing service variable is represented by `preserve()`. Values remain
in Railway. Add an existing variable to this inventory before applying a future
configuration change. Omitting a variable schedules its deletion. Routine runtime
changes must preserve variables, source connections, domains and data resources.
Do not use decrypted imports or print variable values to review a plan.

Commit the reviewed configuration before creating a pinned plan:

```sh
railway config plan --out /private/tmp/fixflags-runtime-plan.json
railway config apply --plan /private/tmp/fixflags-runtime-plan.json --yes
```

Review the plan before applying it. A runtime migration should contain only the
intended application settings, with no additions or destructive changes. The
pinned plan rejects configuration drift and a changed authoring tree. GitHub CI
and Railway Wait for CI remain disabled; infrastructure changes are applied
through this local workflow.

Railway does not read this authoring file during a Git deployment. Apply the
reviewed settings before deploying code that relies on them. Both services use
the root Dockerfile, `/api/health/ready`, a 300-second readiness window and three
failure restarts. The worker explicitly starts `node scripts/runtime-start.mjs
worker`; the Docker image starts the web runtime. The shared launcher owns process
roles, default worker concurrency, migration admission and graceful shutdown.

Railway normalizes its default `ON_FAILURE` policy to an omitted field. Keep
`restartPolicyType` omitted in the authoring form and verify the effective live
policy is `ON_FAILURE` with three retries after applying. Declaring the default
explicitly produces a repeated default-only plan difference.

The superseded `railway.toml` and unused `railway.worker.toml` are removed. After a
migration, verify both deployed revisions, strict readiness, fresh worker health,
and a zero-change `railway config plan`.
