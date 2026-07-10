-- Add new AuditSource values for free tools and programmatic pages.
-- PostgreSQL requires separate ALTER TYPE statements (cannot batch in a transaction).
ALTER TYPE "AuditSource" ADD VALUE IF NOT EXISTS 'TOOL_PAGE';
ALTER TYPE "AuditSource" ADD VALUE IF NOT EXISTS 'ISSUE_PAGE';
ALTER TYPE "AuditSource" ADD VALUE IF NOT EXISTS 'BENCHMARK_PAGE';
