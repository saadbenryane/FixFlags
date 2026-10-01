# Empty Outcome selection needs an explicit run scope

## Finding

Broad Site care and targeted diagnostic Flag verification can both have zero Outcome selections. Treating only the selection list as run identity makes them look equivalent, so an active Flag verification can be incorrectly reused for a customer asking to refresh stale Site evidence.

## Durable rule

An empty selection is valid only with an explicit purpose. Broad Site care uses `scope: 'SITE'`, no verification target, the shared `RunRequest` command and the existing physical Audit ledger. It refreshes diagnostic evidence but creates no Outcome assessment.

Idempotency and active-run reuse must compare both the Outcome selection and the verification target. A Site-care run, a diagnostic Flag verification and an Outcome verification are distinct executions even when their selection arrays match.
