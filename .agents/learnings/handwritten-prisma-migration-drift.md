# Hand-written Prisma migrations drift silently on column and index name

`prisma/migrations/20260927070000_outcome_binding_attempts/migration.sql` was
written by hand for the append-only binding-attempt ledger. It passed
`tsc`, `eslint`, the unit suite, and review, and still failed to apply:

1. `CREATE TABLE` omitted the `executionId` column that the indexes, foreign
   key, and backfill all referenced, so the migration died with
   `42703 column "executionId" does not exist`.
2. The unique index was declared as
   `outcome_binding_attempts_auditId_outcomeId_bindingKey_attempt_key`, which is
   65 characters. Postgres silently truncated it to 63, giving
   `..._attempt_k`, while Prisma expects its own truncated form
   `..._attem_key`. The table then stayed permanently in schema drift even
   though the migration reported success.

Two rules prevent both.

**Generate the DDL, do not recall it.** Before committing a hand-written
migration, diff the datamodel to SQL and copy the exact statements:

```bash
npm run db:check    # migrate status
npm run db:drift    # migrate diff --from-schema-datasource --to-schema-datamodel --exit-code
npm run db:deploy   # apply forward, then db:check and db:drift must both be clean
```

`prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma
--script` prints the canonical `CREATE TABLE`, index, and constraint text,
including the exact identifier Prisma will look for later. Identifier length is
the trap: Prisma and Postgres truncate differently, so a name that looks
correct in the migration file is not necessarily the name that ends up in the
catalog.

**Apply it locally before claiming it works.** A migration that has never been
applied is not a migration. `db:drift` exiting 0 is the check; `db:deploy`
succeeding is not, because it can succeed into drift.

When a migration fails mid-apply, Postgres rolls the transaction back, but the
ledger keeps a failed row and `migrate deploy` then refuses every later
migration. Recover with `prisma migrate resolve --rolled-back <name>`. Note
that resolving marks the *failed* row only. If a previous attempt had already
succeeded and you then dropped the table by hand, the successful row still
claims the migration is applied, so delete those ledger rows before re-running
`db:deploy`, or the migration will be skipped and the table will stay missing.
