\set ON_ERROR_STOP on
\if :{?deep}
\else
  \set deep false
\endif

BEGIN READ ONLY;
SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '30s';
SET LOCAL TIME ZONE 'UTC';

SELECT current_setting('server_version') AS postgres_version,
       pg_database_size(current_database()) AS database_bytes;

SELECT schemaname, relname,
       pg_total_relation_size(relid) AS total_bytes,
       pg_table_size(relid) AS table_and_toast_bytes,
       pg_indexes_size(relid) AS index_bytes,
       n_live_tup AS estimated_live_rows, n_dead_tup AS estimated_dead_rows,
       last_autovacuum, last_autoanalyze
FROM pg_stat_user_tables
ORDER BY total_bytes DESC
LIMIT 30;

SELECT count(*) AS slot_count,
       count(*) FILTER (WHERE NOT active) AS inactive_slot_count,
       max(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS max_retained_wal_bytes
FROM pg_replication_slots
WHERE NOT pg_is_in_recovery();

-- Run payload scans on a restored copy or a deliberately chosen low-traffic window.
-- Output contains only categories, row counts, and bytes.
\if :deep
-- Match the existing retention policies. Unsettled budget windows remain excluded.
SELECT 'uptime_probes' AS expiry_backlog, count(*) AS rows
FROM uptime_probes WHERE "observedAt" < now() - interval '30 days'
UNION ALL SELECT 'product_signals', count(*) FROM product_signals WHERE "expiresAt" <= now()
UNION ALL SELECT 'provider_spend_windows', count(*) FROM provider_spend_windows
WHERE "expiresAt" < now() AND "reservedMicros" = 0
UNION ALL SELECT 'site_account_messages', count(*) FROM site_account_messages WHERE "expiresAt" <= now();

SELECT event, status, count(*) AS rows, sum(pg_column_size(detail)) AS stored_detail_bytes
FROM audit_pipeline_events
GROUP BY event, status
ORDER BY stored_detail_bytes DESC NULLS LAST
LIMIT 30;

SELECT "workKind", count(*) AS rows, sum(pg_column_size("workInput")) AS stored_input_bytes,
       sum(pg_column_size("workResult")) AS stored_result_bytes
FROM audit_execution_tasks
GROUP BY "workKind"
ORDER BY stored_result_bytes DESC NULLS LAST
LIMIT 30;

-- An exact match is a candidate, not a deletion instruction. Earlier or
-- partial generations can contain observations absent from the current task.
SELECT count(*) AS duplicate_terminal_payloads,
       coalesce(sum(pg_column_size(event.detail) - pg_column_size(event.detail - 'observations')), 0)
         AS estimated_duplicate_detail_bytes
FROM audit_pipeline_events event
JOIN audit_execution_tasks task ON task.id = event."executionId" AND task."auditId" = event."auditId"
WHERE event.event = 'task_observation_committed' AND event.status = 'completed'
  AND task."workState" = 'COMPLETED'
  AND event.detail->>'taskId' = task.id
  AND event.detail->>'kind' = task."workKind"
  AND event.detail->'generation' = to_jsonb(task."workGeneration")
  AND event.detail->'observations' = task."workResult"->'data';
\endif

ROLLBACK;
