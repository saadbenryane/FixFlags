import type { AdminActor } from '@/lib/auth/require-admin'
import { adminRead } from './workspace-queries'
import { AdminActionError } from './errors'
import { appendAdminActivity } from './activity'
import { redactAdminContent } from './security'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
export async function loadAdminEvidence(actor: AdminActor, grantId: string) {
  return adminRead(actor, async (db) => {
    const grant = await db.adminEvidenceGrant.findFirst({
      where: {
        id: grantId,
        actorId: actor.id,
        sessionId: actor.sessionId,
        expiresAt: { gt: new Date() },
      },
      include: { operation: true },
    })
    if (!grant)
      throw new AdminActionError(
        'Private evidence access expired or belongs to another session. Request a new grant.',
        403,
        'EVIDENCE_ACCESS_EXPIRED',
      )
    const audit = await db.audit.findUnique({
      where: { id: grant.auditId },
      select: {
        id: true,
        status: true,
        failureCode: true,
        executionSpec: true,
        flags: { select: { id: true, problem: true, evidence: true, fix: true, severity: true } },
        screenshots: { select: { id: true, device: true, url: true } },
      },
    })
    if (!audit) throw new AdminActionError('Check no longer exists.', 404, 'NOT_FOUND')
    await appendAdminActivity(db, grant.operation, 'EVIDENCE_VIEWED', {
      grantId,
      expiresAt: grant.expiresAt.toISOString(),
    })
    return {
      audit: {
        ...audit,
        executionSpec: adminExecutionSummary(audit.executionSpec),
        screenshots: audit.screenshots.map((s) => {
          const url = new URL(s.url),
            pageKey = url.searchParams.get('page')
          if (
            url.pathname !== `/api/screenshots/${audit.id}/${s.device.toLowerCase()}` ||
            (pageKey && !/^[a-zA-Z0-9_-]{1,80}$/.test(pageKey))
          )
            throw new AdminActionError(
              'A capture has an unsupported storage reference.',
              409,
              'CAPTURE_REFERENCE_INVALID',
            )
          return { id: s.id, device: s.device, pageKey }
        }),
        flags: audit.flags.map((f) => ({
          ...f,
          problem: redactAdminContent(f.problem),
          evidence: redactAdminContent(f.evidence),
          fix: redactAdminContent(f.fix),
        })),
      },
      expiresAt: grant.expiresAt.toISOString(),
    }
  })
}

export function adminExecutionSummary(value: unknown) {
  const spec = readExecutionSpec(value)
  return spec
    ? {
        version: spec.version,
        scope: spec.scope,
        environment: spec.environment,
        reviewDepth: spec.reviewDepth ?? null,
        category: spec.category?.area ?? null,
        checks: spec.checks,
        accountMode: spec.accountChecks?.mode ?? null,
        fixture: spec.fixtureSetup ?? null,
        outcomes: spec.outcomes.map((o) => ({
          id: o.id,
          kind: o.kind,
          bindingPolicy: o.bindingPolicy,
          bindings: o.bindings.map((b) => ({
            key: b.key,
            version: b.version,
            mechanism: b.mechanism,
            required: b.required,
          })),
        })),
      }
    : null
}
