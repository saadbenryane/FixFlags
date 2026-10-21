-- The admitted-scope index now serves browser and behavior history reads.
DROP INDEX CONCURRENTLY "audit_verifier_browser_scope_idx";
