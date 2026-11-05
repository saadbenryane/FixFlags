-- Recovery proofs and resolved-Flag listings read flags by status and the
-- completed verification that closed them. One index serves both lanes, and
-- the build stays outside an explicit transaction so ordinary writes continue.
CREATE INDEX CONCURRENTLY "flags_status_resolvedInId_idx"
  ON "flags" ("status", "resolvedInId");
