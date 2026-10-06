# Read-only UI proof must not start the worker

Date: 2026-10-06
Scope: local browser verification
Confidence: high

## Discovery

`npm run dev -- -p 3106` did not pass the port to Next. The repository `dev`
script ran its predev port cleanup and started both web and worker through
`concurrently`. During a Docs-only proof, that worker claimed an existing local
AI-review job, which failed because its desktop screenshot was missing. The
processes were stopped immediately.

## Rule

For read-only route or UI proof, start the web process directly with an explicit
port: `npx next dev -p <port>`. Use the combined `npm run dev` command only when
the task intentionally needs a live worker and may process queued local jobs.

This prevents a visual check from mutating queue state or interfering with an
unrelated service on the repository's default port.
