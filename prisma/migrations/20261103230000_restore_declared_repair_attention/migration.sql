-- The former already-fixed action recorded readiness, then hid the source.
-- Restore only exact retained declarations with no recorded rejection. This
-- repairs lifecycle projection, never the original evidence or recovery proof.
-- restore_declared_repair_attention
DO $migration$
DECLARE scope RECORD;
BEGIN
  FOR scope IN
    SELECT DISTINCT incident."projectId" FROM improvements AS incident
    JOIN improvement_occurrences AS occurrence ON occurrence."improvementId" = incident.id
    JOIN flags AS f ON f.id = occurrence."flagId" AND f.status = 'IGNORED'
    JOIN improvement_attempts AS attempt ON attempt."improvementId" = incident.id
      AND attempt.builder = 'user-decision' AND attempt."handoffReference" = 'flag:' || f.id
    ORDER BY incident."projectId"
  LOOP
    -- Owner actions and workers acquire the Site before changing its sources.
    -- Read eligibility in the next statement after any competing action settles.
    PERFORM id FROM projects WHERE id = scope."projectId" FOR UPDATE;
    UPDATE flags AS f
    SET status = CASE occurrence.kind
      WHEN 'REGRESSED' THEN 'REGRESSED'::"FlagStatus"
      WHEN 'CLEARED' THEN 'FIXED'::"FlagStatus"
      ELSE 'OPEN'::"FlagStatus"
    END
    FROM improvement_occurrences AS occurrence
    JOIN improvements AS incident ON incident.id = occurrence."improvementId"
    JOIN audits AS source ON source.id = occurrence."auditId" AND source."projectId" = incident."projectId"
    WHERE f.id = occurrence."flagId" AND f."auditId" = source.id AND f.status = 'IGNORED'
      AND incident."projectId" = scope."projectId"
      AND incident.status NOT IN ('REJECTED', 'SUPERSEDED')
      AND incident."rejectedAt" IS NULL AND incident."rejectionReason" IS NULL AND incident."rejectionNote" IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM improvement_cycles AS cycle
        JOIN improvement_cycle_events AS event ON event."cycleId" = cycle.id
        WHERE cycle."improvementId" = incident.id AND event.type = 'REJECTED'
      )
      AND EXISTS (
        SELECT 1 FROM improvement_attempts AS attempt
        WHERE attempt."improvementId" = incident.id AND attempt."sourceAuditId" = source.id
          AND attempt.builder = 'user-decision' AND attempt."handoffReference" = 'flag:' || f.id
          AND (cardinality(attempt."sourceFlagIds") = 0 OR f.id = ANY(attempt."sourceFlagIds"))
      );
  END LOOP;
END;
$migration$;
