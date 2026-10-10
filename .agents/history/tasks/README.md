# Durable completed task records

Create a record only when work is multi-step, concurrent, decision-heavy, or requires a future handoff. Routine edits and read-only investigations do not need one.

Finish a claimed task with an outcome and one or more evidence references:

```bash
npm run agent -- task finish <task-id> \
  --owner <name> \
  --summary "What changed and what remains uncertain" \
  --evidence "Focused test or receipt"
```

The command creates `<task-id>.md` without overwriting an existing record. Do not include raw prompts, source excerpts, credentials, customer data, or model transcripts.
