import { z } from 'zod'
import { prisma } from '@/lib/db'
import { decryptSecret } from '@/lib/security/crypto'
import { normalizeAuditUrl, assertPublicAuditUrl } from '@/lib/audit/url'
import { getBrowser } from '@/lib/audit/screenshot'
import { createAuditPage } from '@/lib/audit/browser/page-session'
import { DESKTOP_CAPTURE_PROFILE } from '@/lib/audit/browser/capture-profile'
import { executionWrite, executionTransaction, currentExecutionOwnership } from '@/lib/audit/execution-ownership'
import { safeFormRequestAllowed } from '@/lib/audit/browser/safe-form-safety'
import { safeFormMappingSchema, safeFormValuesSchema, safeFormSuccessSchema, type AccessibleTarget } from '../domain/safe-form'
export { accessibleTargetSchema, safeFormMappingSchema, safeFormValuesSchema, safeFormSuccessSchema } from '../domain/safe-form'
export type { AccessibleTarget } from '../domain/safe-form'

/** Retry is allowed only after the admitted fixture's cleanup is proved, using
 * current authorization. No secret values or external effects are replayed here. */
export async function reconcileSafeFixtureCleanup(input: { projectId: string; fixtureId: string; version: number; auditId?: string }) {
  const fixture = await prisma.outcomeFixture.findFirst({ where: {
    id: input.fixtureId, projectId: input.projectId, enabled: true, version: input.version,
    authorizedAt: { not: null }, lastDryRunVersion: input.version,
  } })
  if (!fixture) return false
  const target = normalizeAuditUrl(fixture.targetUrl)
  if (!target.ok) return false
  const cleanup = safeExactOrigin(fixture.cleanupUrl, new URL(target.url).origin)
  if (!cleanup) return false
  try {
    const secret = fixture.encryptedHookSecret ? decryptSecret(fixture.encryptedHookSecret) : null
    await executionWrite(tx => tx.outcomeFixture.findUniqueOrThrow({ where: { id: fixture.id } }))
    const submission = input.auditId ? await prisma.auditPipelineEvent.findFirst({
      where: { auditId: input.auditId, event: 'protected_submission_admitted',
        detail: { path: ['fixtureId'], equals: fixture.id } }, orderBy: { sequence: 'desc' }, select: { detail: true },
    }) : null
    const operation = submission ? z.object({ operationId: z.string(), fixtureId: z.literal(fixture.id), fixtureVersion: z.literal(fixture.version) }).safeParse(submission.detail) : null
    if (submission && !operation?.success) return false
    return await callHook(cleanup, secret, fixture.id,
      operation?.success ? { operationId: operation.data.operationId, requireSettled: true } : undefined)
  } catch { return false }
}

export type SafeFormExecutionResult = {
  disposition: 'SUCCEEDED' | 'FAILED' | 'BLOCKED'
  reason: string
  detail: { fieldCount: number; cleanupStatus: 'succeeded' | 'failed' | 'not_started' }
}

export function safeExactOrigin(url: string, origin: string): string | null {
  const normalized = normalizeAuditUrl(url)
  if (!normalized.ok) return null
  return new URL(normalized.url).origin === origin ? normalized.url : null
}

async function callHook(url: string, secret: string | null, fixtureId: string,
  operation?: { operationId: string; requireSettled?: boolean }): Promise<boolean> {
  try { await assertPublicAuditUrl(url) } catch { return false }
  const response = await fetch(url, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(8_000),
    headers: {
      'content-type': 'application/json',
      ...(secret ? { authorization: `Bearer ${secret}` } : {}),
    },
    body: JSON.stringify({ fixtureId, ...(operation ? { operationId: operation.operationId } : {}) }),
  }).catch(() => null)
  if (!response?.ok) return false
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
}

export async function executeSafeFormFixture(input: {
  projectId: string
  fixtureId: string
  startUrl: string
  allowLocalhost: boolean
  requireAuthorization?: boolean
  expectedVersion?: number
}): Promise<SafeFormExecutionResult> {
  const fixture = await prisma.outcomeFixture.findFirst({
    where: { id: input.fixtureId, projectId: input.projectId, enabled: true },
  })
  if (!fixture || (input.requireAuthorization !== false && (!fixture.authorizedAt || fixture.lastDryRunVersion !== fixture.version))) {
    return { disposition: 'BLOCKED', reason: 'fixture_not_authorized', detail: { fieldCount: 0, cleanupStatus: 'not_started' } }
  }
  if (input.expectedVersion !== undefined && fixture.version !== input.expectedVersion) {
    return { disposition: 'BLOCKED', reason: 'fixture_changed', detail: { fieldCount: 0, cleanupStatus: 'not_started' } }
  }
  const target = normalizeAuditUrl(input.startUrl)
  if (!target.ok || new URL(target.url).href !== new URL(fixture.targetUrl).href) {
    return { disposition: 'BLOCKED', reason: 'fixture_target_mismatch', detail: { fieldCount: 0, cleanupStatus: 'not_started' } }
  }
  const origin = new URL(target.url).origin
  if (new URL(target.url).protocol !== 'https:' && !(input.allowLocalhost && ['localhost', '127.0.0.1'].includes(new URL(target.url).hostname)))
    return { disposition: 'BLOCKED', reason: 'fixture_https_required', detail: { fieldCount: 0, cleanupStatus: 'not_started' } }
  const resetUrl = safeExactOrigin(fixture.resetUrl, origin)
  const cleanupUrl = safeExactOrigin(fixture.cleanupUrl, origin)
  if (!resetUrl || !cleanupUrl) {
    return { disposition: 'BLOCKED', reason: 'fixture_hook_origin_mismatch', detail: { fieldCount: 0, cleanupStatus: 'not_started' } }
  }

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
  if (!await callHook(resetUrl, hookSecret, fixture.id)) {
    return { disposition: 'BLOCKED', reason: 'fixture_reset_unproven', detail: { fieldCount: 0, cleanupStatus: 'not_started' } }
  }

  let disposition: SafeFormExecutionResult['disposition'] = 'BLOCKED'
  let reason = 'form_execution_failed'
  let cleanupStatus: SafeFormExecutionResult['detail']['cleanupStatus'] = 'not_started'
  let session: Awaited<ReturnType<typeof createAuditPage>> | undefined
  const owner = currentExecutionOwnership()
  const operationId = owner ? `${owner.taskId ?? owner.auditId}:g${owner.generation}` : null
  const deadline = Date.now() + 45_000
  let requestRefused = false
  try {
    const browser = await getBrowser()
    session = await createAuditPage(browser, target.url, {
      profile: DESKTOP_CAPTURE_PROFILE, allowLocalhost: input.allowLocalhost,
      deadline,
      configurePage: async page => {
        await page.route('**', async route => {
          const request = route.request()
          if (!safeFormRequestAllowed({ url: request.url(), method: request.method(), navigation: request.isNavigationRequest(), origin, values: Object.values(values) })) {
            requestRefused = true
            await route.abort('blockedbyclient')
          } else await route.fallback() // Retain the existing SSRF/public-target guard.
        })
      },
    })
    for (const [key, target] of Object.entries(mapping.data.fields)) {
      if (Date.now() >= deadline) throw new Error('Fixture execution deadline exhausted')
      await targetLocator(session.page, target).first().fill(values[key]!, { timeout: Math.max(1, Math.min(8000, deadline - Date.now())) })
    }
    const current = await executionTransaction(async tx => {
    const authorized = await tx.outcomeFixture.findFirst({
      where: { id: fixture.id, projectId: input.projectId, enabled: true, version: fixture.version },
      select: { authorizedAt: true, lastDryRunVersion: true },
    })
    if (authorized && (input.requireAuthorization === false || authorized.authorizedAt && authorized.lastDryRunVersion === fixture.version) && owner && operationId)
      await tx.auditPipelineEvent.create({ data: { auditId: owner.auditId, executionId: operationId, traceId: owner.auditId,
        attempt: owner.generation, stage: 'checking', event: 'protected_submission_admitted', status: 'started',
        detail: { operationId, fixtureId: fixture.id, fixtureVersion: fixture.version } } })
    return authorized
    })
    if (!current || (input.requireAuthorization !== false && (!current.authorizedAt || current.lastDryRunVersion !== fixture.version))) {
      reason = 'fixture_not_authorized'
    } else {
    if (Date.now() >= deadline) throw new Error('Fixture execution deadline exhausted')
    await targetLocator(session.page, mapping.data.submit).first().click({ timeout: Math.max(1, Math.min(8000, deadline - Date.now())) })
    const observedOrigin = new URL(session.page.url()).origin
    if (observedOrigin !== origin) {
      reason = 'form_left_authorized_origin'
    } else if (success.data.type === 'text') {
      const found = await session.page.getByText(success.data.value, { exact: false }).first().isVisible().catch(() => false)
      disposition = found ? 'SUCCEEDED' : 'FAILED'
      reason = found ? 'success_criterion_observed' : 'success_text_missing'
    } else if (success.data.type === 'target') {
      const found = await targetLocator(session.page, success.data.target).first().isVisible().catch(() => false)
      disposition = found ? 'SUCCEEDED' : 'FAILED'
      reason = found ? 'success_criterion_observed' : 'success_target_missing'
    } else {
      const found = new URL(session.page.url()).href === new URL(success.data.value).href
      disposition = found ? 'SUCCEEDED' : 'FAILED'
      reason = found ? 'success_criterion_observed' : 'success_url_missing'
    }
    }
  } catch {
    disposition = 'BLOCKED'
    reason = 'form_execution_failed'
  } finally {
    await session?.page.context().close().catch(() => undefined)
    cleanupStatus = await callHook(cleanupUrl, hookSecret, fixture.id, operationId ? { operationId } : undefined) ? 'succeeded' : 'failed'
  }
  if (cleanupStatus !== 'succeeded') {
    return { disposition: 'BLOCKED', reason: 'fixture_cleanup_unproven', detail: { fieldCount: Object.keys(mapping.data.fields).length, cleanupStatus } }
  }
  if (disposition === 'FAILED' && requestRefused)
    return { disposition: 'BLOCKED', reason: 'fixture_boundary_refused', detail: { fieldCount: Object.keys(mapping.data.fields).length, cleanupStatus } }
  return { disposition, reason, detail: { fieldCount: Object.keys(mapping.data.fields).length, cleanupStatus } }
}

function targetLocator(page: Awaited<ReturnType<typeof createAuditPage>>['page'], target: AccessibleTarget) {
  if (target.by === 'label') return page.getByLabel(target.value, { exact: true })
  if (target.by === 'placeholder') return page.getByPlaceholder(target.value, { exact: true })
  return page.getByRole(target.role, { name: target.value, exact: true })
}
