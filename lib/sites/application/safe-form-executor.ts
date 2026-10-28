import { z } from 'zod'
import { errors } from 'playwright'
import type { Prisma } from '@prisma/client'
import { readExecutionSpec } from '../domain/execution-spec'
import { publicHttpCapacity } from '@/lib/audit/progressive/capacity'
import { prisma } from '@/lib/db'
import { decryptSecret } from '@/lib/security/crypto'
import { normalizeAuditUrl, normalizeAuditNavigationUrl, assertPublicAuditUrl } from '@/lib/audit/url'
import { getBrowser } from '@/lib/audit/screenshot'
import { createAuditPage } from '@/lib/audit/browser/page-session'
import { DESKTOP_CAPTURE_PROFILE } from '@/lib/audit/browser/capture-profile'
import { executionWrite, executionTransaction, currentExecutionOwnership } from '@/lib/audit/execution-ownership'
import { safeFormRequestAllowed } from '@/lib/audit/browser/safe-form-safety'
import { safeFormMappingSchema, safeFormValuesSchema, safeFormSuccessSchema, type AccessibleTarget } from '../domain/safe-form'
import { fixtureOwnerCurrent } from '../domain/fixture-authority'
export { accessibleTargetSchema, safeFormMappingSchema, safeFormValuesSchema, safeFormSuccessSchema } from '../domain/safe-form'
export type { AccessibleTarget } from '../domain/safe-form'

/** Retry is allowed only after the admitted fixture's cleanup is proved, using
 * current authorization. No secret values or external effects are replayed here. */
export async function reconcileSafeFixtureCleanup(input: { projectId: string; fixtureId: string; version: number; requireAuthorization?: boolean }) {
  const fixture = await prisma.outcomeFixture.findFirst({ where: {
    id: input.fixtureId, projectId: input.projectId, enabled: true, version: input.version,
    ...(input.requireAuthorization === false ? {} : { authorizedAt: { not: null }, lastDryRunVersion: input.version }),
  }, include: { project: { select: { userId: true } } } })
  if (!fixture || !fixtureOwnerCurrent(fixture)) return false
  const target = normalizeAuditNavigationUrl(fixture.targetUrl)
  if (!target.ok) return false
  const cleanup = safeExactOrigin(fixture.cleanupUrl, new URL(target.url).origin)
  if (!cleanup) return false
  try {
    const secret = fixture.encryptedHookSecret ? decryptSecret(fixture.encryptedHookSecret) : null
    await executionWrite(tx => tx.outcomeFixture.findUniqueOrThrow({ where: { id: fixture.id } }))
    // A newer settled operation cannot hide an older unsettled one. Match
    // receipts before LIMIT, including cleanup recorded by a later recovery run.
    const pending = await prisma.$queryRaw<Array<{ executionId: string; detail: Prisma.JsonValue }>>`
      SELECT e."executionId", e.detail FROM audit_pipeline_events e
      JOIN audits a ON a.id = e."auditId"
      WHERE a."projectId" = ${input.projectId} AND e.event = 'protected_submission_admitted'
        AND e.detail->>'fixtureId' = ${fixture.id}
        AND NOT EXISTS (
          SELECT 1 FROM audit_pipeline_events c JOIN audits ca ON ca.id = c."auditId"
          WHERE ca."projectId" = a."projectId" AND c.event = 'protected_cleanup_completed'
            AND c."executionId" = e."executionId"
            AND c.detail->>'fixtureId' = e.detail->>'fixtureId'
            AND c.detail->'fixtureVersion' = e.detail->'fixtureVersion'
        )
      ORDER BY e.sequence ASC LIMIT 3`
    for (const submission of pending.slice(0, 2)) {
      const operation = z.object({ operationId: z.string(), fixtureId: z.literal(fixture.id), fixtureVersion: z.number().int().positive() }).safeParse(submission.detail)
      if (!operation.success || operation.data.operationId !== submission.executionId || operation.data.fixtureVersion !== fixture.version) return false
      // The recorded admission retains settlement of this operation, not
      // permission for another reset or submission. Those still need live consent.
      if (!await callHook(cleanup, secret, fixture.id, { operationId: operation.data.operationId, requireSettled: true })) return false
      await recordFixtureCleanup(operation.data.operationId, fixture.id, operation.data.fixtureVersion)
    }
    // Bound hook calls without allowing the uninspected remainder to grant replay.
    return pending.length <= 2
  } catch { return false }
}

async function recordFixtureCleanup(operationId: string, fixtureId: string, fixtureVersion: number) {
  const owner = currentExecutionOwnership()
  if (!owner) return
  await executionWrite(tx => tx.auditPipelineEvent.create({ data: { auditId: owner.auditId, executionId: operationId,
    traceId: owner.auditId, attempt: owner.generation, stage: 'checking', event: 'protected_cleanup_completed', status: 'completed',
    detail: { operationId, fixtureId, fixtureVersion } } }))
}

export const safeFormExecutionResultSchema = z.object({
  disposition: z.enum(['SUCCEEDED', 'FAILED', 'BLOCKED']), reason: z.string().min(1),
  detail: z.object({ fieldCount: z.number().int().nonnegative(), cleanupStatus: z.enum(['succeeded', 'failed', 'not_started', 'unknown']),
    successObservation: z.object({ source: z.literal('rendered-dom'), criterionType: z.enum(['text', 'url', 'target']),
      presentBeforeSubmit: z.boolean(), presentAfterSubmit: z.boolean().nullable(), waitLimitMs: z.number().int().nonnegative().max(8000),
    }).strict().optional(),
  }).strict(),
}).strict()

async function setupConsent(projectId: string, fixtureId: string, version: number, db: typeof prisma | Prisma.TransactionClient = prisma) {
  const owner = currentExecutionOwnership()
  if (!owner?.taskId) return false
  const admitted = await db.audit.findFirst({ where: { id: owner.auditId, projectId, runRequests: { some: { status: { in: ['QUEUED', 'RUNNING'] } } } },
    select: { executionSpec: true } })
  const spec = readExecutionSpec(admitted?.executionSpec)
  return spec?.scope === 'FIXTURE_SETUP' && spec.fixtureSetup?.id === fixtureId && spec.fixtureSetup.version === version
}

export type SafeFormExecutionResult = z.infer<typeof safeFormExecutionResultSchema>

export function safeExactOrigin(url: string, origin: string): string | null {
  const normalized = normalizeAuditUrl(url)
  if (!normalized.ok) return null
  return new URL(normalized.url).origin === origin ? normalized.url : null
}

async function callHook(url: string, secret: string | null, fixtureId: string,
  operation?: { operationId?: string; requireSettled?: boolean; beforeRequest?: () => Promise<boolean> }): Promise<boolean> {
  const signal = AbortSignal.timeout(8000)
  try {
    await new Promise<void>((resolve, reject) => {
      const abort = () => reject(signal.reason)
      signal.addEventListener('abort', abort, { once: true })
      void assertPublicAuditUrl(url).then(() => resolve(), reject)
        .finally(() => signal.removeEventListener('abort', abort))
    })
  } catch { return false }
  const release = await publicHttpCapacity.acquire(signal).catch(() => null)
  if (!release) return false
  try {
    if (operation?.beforeRequest && !await operation.beforeRequest()) return false
    if (signal.aborted) return false
    const response = await fetch(url, {
      method: 'POST',
      redirect: 'error',
      signal,
      headers: {
        'content-type': 'application/json',
        ...(secret ? { authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify({ fixtureId, ...(operation?.operationId ? { operationId: operation.operationId } : {}) }),
    }).catch(() => null)
    if (!response?.ok) { await response?.body?.cancel().catch(() => undefined); return false }
    const reader = response.body?.getReader()
    if (!reader) return false
    const chunks: Uint8Array[] = []
    let size = 0
    try {
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) break
        size += chunk.value.byteLength
        if (size > 16_384) { await reader.cancel(); return false }
        chunks.push(chunk.value)
      }
      const result = z.object({ ok: z.literal(true), operationId: z.string().optional(), settled: z.boolean().optional() })
        .safeParse(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      return result.success && (!operation?.requireSettled || result.data.operationId === operation.operationId && result.data.settled === true)
    } catch { return false } finally { reader.releaseLock() }
  } finally { release() }
}

const blockedAdmission = (reason: string): SafeFormExecutionResult => ({ disposition: 'BLOCKED', reason, detail: { fieldCount: 0, cleanupStatus: 'not_started' } })

/** Admission stops before a browser session. A matching fixture is not confirmation. */
export function refuseSafeFormAdmission(fixture: {
  authorizedAt: Date | null; lastDryRunVersion: number | null; version: number; targetUrl: string; resetUrl: string; cleanupUrl: string
} | null, input: { requireAuthorization?: boolean; expectedVersion?: number; startUrl: string; allowLocalhost: boolean; setupAdmitted: boolean }): SafeFormExecutionResult | null {
  if (!fixture || (input.requireAuthorization !== false && (!fixture.authorizedAt || fixture.lastDryRunVersion !== fixture.version)))
    return blockedAdmission('fixture_not_authorized')
  if (input.requireAuthorization === false && !input.setupAdmitted) return blockedAdmission('fixture_setup_not_admitted')
  if (input.expectedVersion !== undefined && fixture.version !== input.expectedVersion) return blockedAdmission('fixture_changed')
  const target = normalizeAuditNavigationUrl(input.startUrl)
  if (!target.ok || new URL(target.url).href !== new URL(fixture.targetUrl).href) return blockedAdmission('fixture_target_mismatch')
  if (new URL(target.url).protocol !== 'https:' && !(input.allowLocalhost && ['localhost', '127.0.0.1'].includes(new URL(target.url).hostname)))
    return blockedAdmission('fixture_https_required')
  const origin = new URL(target.url).origin
  if (!safeExactOrigin(fixture.resetUrl, origin) || !safeExactOrigin(fixture.cleanupUrl, origin)) return blockedAdmission('fixture_hook_origin_mismatch')
  return null
}

/** Cleanup and the request boundary override an observed success. They cannot create one. */
export function concludeSafeFormAttempt(input: { disposition: SafeFormExecutionResult['disposition']; reason: string;
  detail: SafeFormExecutionResult['detail']; requestRefused: boolean }): SafeFormExecutionResult {
  if (input.detail.cleanupStatus !== 'succeeded') return { disposition: 'BLOCKED', reason: 'fixture_cleanup_unproven', detail: input.detail }
  if (input.requestRefused) return { disposition: 'BLOCKED', reason: 'fixture_boundary_refused', detail: input.detail }
  return { disposition: input.disposition, reason: input.reason, detail: input.detail }
}

export async function executeSafeFormFixture(input: {
  projectId: string
  fixtureId: string
  startUrl: string
  allowLocalhost: boolean
  requireAuthorization?: boolean
  expectedVersion?: number
  deadline?: number
}): Promise<SafeFormExecutionResult> {
  const fixture = await prisma.outcomeFixture.findFirst({
    where: { id: input.fixtureId, projectId: input.projectId, enabled: true,
      project: { deletedAt: null, user: { lifecycleStatus: 'ACTIVE' } } },
    include: { project: { select: { userId: true } } },
  })
  if (!fixture || !fixture.configuredByUserId || !fixtureOwnerCurrent(fixture)) return blockedAdmission('fixture_not_authorized')
  const setupAdmitted = fixture && input.requireAuthorization === false ? await setupConsent(input.projectId, fixture.id, fixture.version) : true
  const refused = refuseSafeFormAdmission(fixture, { ...input, setupAdmitted })
  if (refused || !fixture) return refused ?? blockedAdmission('fixture_not_authorized')
  const target = normalizeAuditNavigationUrl(input.startUrl)
  if (!target.ok) return blockedAdmission('fixture_target_mismatch')
  const origin = new URL(target.url).origin
  const resetUrl = safeExactOrigin(fixture.resetUrl, origin)!
  const cleanupUrl = safeExactOrigin(fixture.cleanupUrl, origin)!

  const mapping = safeFormMappingSchema.safeParse(fixture.fieldMapping)
  const success = safeFormSuccessSchema.safeParse(fixture.successCriterion)
  let values: z.infer<typeof safeFormValuesSchema>
  let hookSecret: string | null = null
  try {
    values = safeFormValuesSchema.parse(JSON.parse(decryptSecret(fixture.encryptedValues)))
    hookSecret = fixture.encryptedHookSecret ? decryptSecret(fixture.encryptedHookSecret) : null
  } catch {
    return { disposition: 'BLOCKED', reason: 'fixture_secret_unavailable', detail: { fieldCount: 0, cleanupStatus: 'not_started' } }
  }
  if (!mapping.success || !success.success || !Object.keys(mapping.data.fields).length || Object.keys(mapping.data.fields).some((key) => values[key] == null)) {
    return { disposition: 'BLOCKED', reason: 'fixture_configuration_invalid', detail: { fieldCount: 0, cleanupStatus: 'not_started' } }
  }
  const fixturePermission = async (tx: Prisma.TransactionClient) => {
    const current = await tx.outcomeFixture.findFirst({ where: {
      id: fixture.id, projectId: input.projectId, version: fixture.version, enabled: true,
      configuredByUserId: fixture.configuredByUserId,
      project: { userId: fixture.configuredByUserId!, deletedAt: null, user: { lifecycleStatus: 'ACTIVE' } },
      ...(input.requireAuthorization === false ? {} : { authorizedAt: { not: null }, lastDryRunVersion: fixture.version }),
    }, select: { authorizedAt: true, lastDryRunVersion: true } })
    return current && (input.requireAuthorization !== false || await setupConsent(input.projectId, fixture.id, fixture.version, tx)) ? current : null
  }
  const owner = currentExecutionOwnership()
  if (owner) {
    const current = await executionWrite(tx => tx.outcomeFixture.findFirst({ where: {
      id: fixture.id, projectId: input.projectId, version: fixture.version, enabled: true,
      configuredByUserId: fixture.configuredByUserId,
      project: { userId: fixture.configuredByUserId!, deletedAt: null, user: { lifecycleStatus: 'ACTIVE' } },
    } }))
    if (!current || !await reconcileSafeFixtureCleanup({ projectId: input.projectId, fixtureId: fixture.id,
      version: fixture.version, requireAuthorization: input.requireAuthorization }))
      return { disposition: 'BLOCKED', reason: 'protected_effect_unresolved', detail: { fieldCount: 0, cleanupStatus: 'not_started' } }
  }
  if (!await callHook(resetUrl, hookSecret, fixture.id, { beforeRequest: async () => {
    return Boolean(await executionTransaction(fixturePermission))
  } })) {
    return { disposition: 'BLOCKED', reason: 'fixture_reset_unproven', detail: { fieldCount: 0, cleanupStatus: 'not_started' } }
  }

  let disposition: SafeFormExecutionResult['disposition'] = 'BLOCKED'
  let reason = 'form_execution_failed'
  let cleanupStatus: SafeFormExecutionResult['detail']['cleanupStatus'] = 'not_started'
  let session: Awaited<ReturnType<typeof createAuditPage>> | undefined
  const operationId = owner ? `${owner.taskId ?? owner.auditId}:g${owner.generation}` : null
  const deadline = Math.min(input.deadline ?? Infinity, Date.now() + 45_000)
  let requestRefused = false
  let submissionAdmitted = false
  let submissionEnabled = false
  let successObservation: SafeFormExecutionResult['detail']['successObservation']
  try {
    const browser = await getBrowser()
    session = await createAuditPage(browser, target.url, {
      profile: DESKTOP_CAPTURE_PROFILE, allowLocalhost: input.allowLocalhost,
      deadline,
      requestPolicy: async request => {
        if (!safeFormRequestAllowed({ ...request, origin, values: Object.values(values) })) {
          requestRefused = true; return false
        }
        if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
          (!submissionEnabled || !await executionTransaction(fixturePermission))) {
          requestRefused = true; return false
        }
        return true
      },
    })
    for (const [key, target] of Object.entries(mapping.data.fields)) {
      if (Date.now() >= deadline) throw new Error('Fixture execution deadline exhausted')
      await targetLocator(session.page, target).first().fill(values[key]!, { timeout: Math.max(1, Math.min(8000, deadline - Date.now())) })
    }
    const criterion = success.data
    const successLocator = criterion.type === 'text' ? session.page.getByText(criterion.value, { exact: false }).first()
      : criterion.type === 'target' ? targetLocator(session.page, criterion.target).first() : null
    const presentBeforeSubmit = criterion.type === 'url' ? new URL(session.page.url()).href === new URL(criterion.value).href
      : await successLocator!.isVisible()
    successObservation = { source: 'rendered-dom', criterionType: criterion.type, presentBeforeSubmit, presentAfterSubmit: null, waitLimitMs: 0 }
    if (presentBeforeSubmit) {
      reason = 'success_criterion_preexisting'
    } else {
      const current = await executionTransaction(async tx => {
        const authorized = await fixturePermission(tx)
        if (authorized && (input.requireAuthorization === false || authorized.authorizedAt && authorized.lastDryRunVersion === fixture.version) && owner && operationId) {
          await tx.auditPipelineEvent.create({ data: { auditId: owner.auditId, executionId: operationId, traceId: owner.auditId,
            attempt: owner.generation, stage: 'checking', event: 'protected_submission_admitted', status: 'started',
            detail: { operationId, fixtureId: fixture.id, fixtureVersion: fixture.version } } })
          submissionAdmitted = true
        }
        return authorized
      })
      if (!current || (input.requireAuthorization !== false && (!current.authorizedAt || current.lastDryRunVersion !== fixture.version))) {
        reason = 'fixture_not_authorized'
      } else {
        if (Date.now() >= deadline) throw new Error('Fixture execution deadline exhausted')
        submissionEnabled = true
        await targetLocator(session.page, mapping.data.submit).first().click({ timeout: Math.max(1, Math.min(8000, deadline - Date.now())) })
        const observedOrigin = new URL(session.page.url()).origin
        if (observedOrigin !== origin) {
          reason = 'form_left_authorized_origin'
        } else {
          const waitLimitMs = Math.max(1, Math.min(8000, deadline - Date.now()))
          successObservation.waitLimitMs = waitLimitMs
          try {
            if (successLocator) await successLocator.waitFor({ state: 'visible', timeout: waitLimitMs })
            else if (criterion.type === 'url') await session.page.waitForURL(url => url.href === new URL(criterion.value).href,
              { timeout: waitLimitMs, waitUntil: 'domcontentloaded' })
            if (new URL(session.page.url()).origin !== origin) reason = 'form_left_authorized_origin'
            else {
              disposition = 'SUCCEEDED'
              reason = 'success_criterion_observed'
              successObservation.presentAfterSubmit = true
            }
          } catch (error) {
            if (!(error instanceof errors.TimeoutError)) throw error
            successObservation.presentAfterSubmit = false
            disposition = waitLimitMs === 8000 ? 'FAILED' : 'BLOCKED'
            reason = waitLimitMs === 8000 ? `success_${criterion.type}_missing` : 'success_observation_incomplete'
          }
        }
      }
    }
  } catch {
    disposition = 'BLOCKED'
    reason = 'form_execution_failed'
  } finally {
    await session?.page.context().close().catch(() => undefined)
    cleanupStatus = await callHook(cleanupUrl, hookSecret, fixture.id, operationId ? { operationId } : undefined) ? 'succeeded' : 'failed'
  }
  if (cleanupStatus === 'succeeded' && submissionAdmitted && operationId)
    await recordFixtureCleanup(operationId, fixture.id, fixture.version)
  const detail: SafeFormExecutionResult['detail'] = { fieldCount: Object.keys(mapping.data.fields).length, cleanupStatus,
    ...(successObservation ? { successObservation } : {}) }
  return concludeSafeFormAttempt({ disposition, reason, detail, requestRefused })
}

function targetLocator(page: Awaited<ReturnType<typeof createAuditPage>>['page'], target: AccessibleTarget) {
  if (target.by === 'label') return page.getByLabel(target.value, { exact: true })
  if (target.by === 'placeholder') return page.getByPlaceholder(target.value, { exact: true })
  return page.getByRole(target.role, { name: target.value, exact: true })
}
