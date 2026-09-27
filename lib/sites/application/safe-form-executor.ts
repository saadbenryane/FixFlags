import { z } from 'zod'
import { prisma } from '@/lib/db'
import { decryptSecret } from '@/lib/security/crypto'
import { normalizeAuditUrl } from '@/lib/audit/url'
import { getBrowser } from '@/lib/audit/screenshot'
import { createAuditPage } from '@/lib/audit/browser/page-session'
import { DESKTOP_CAPTURE_PROFILE } from '@/lib/audit/browser/capture-profile'

const mappingSchema = z.object({
  fields: z.record(z.string(), z.string().min(1).max(300)),
  submit: z.string().min(1).max(300),
})
const valuesSchema = z.record(z.string(), z.string().max(1000))
const successSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), value: z.string().min(1).max(500) }),
  z.object({ type: z.literal('selector'), value: z.string().min(1).max(300) }),
  z.object({ type: z.literal('url'), value: z.string().url().max(2048) }),
])

export type SafeFormExecutionResult = {
  disposition: 'SUCCEEDED' | 'FAILED' | 'BLOCKED'
  reason: string
  detail: { fieldCount: number; cleanupStatus: 'succeeded' | 'failed' | 'not_started' }
}

function safeExactOrigin(url: string, origin: string): string | null {
  const normalized = normalizeAuditUrl(url)
  if (!normalized.ok) return null
  return new URL(normalized.url).origin === origin ? normalized.url : null
}

async function callHook(url: string, secret: string | null, fixtureId: string): Promise<boolean> {
  const response = await fetch(url, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(8_000),
    headers: {
      'content-type': 'application/json',
      ...(secret ? { authorization: `Bearer ${secret}` } : {}),
    },
    body: JSON.stringify({ fixtureId }),
  }).catch(() => null)
  if (!response?.ok) return false
  const result = await response.json().catch(() => null) as { ok?: unknown } | null
  return result?.ok === true
}

export async function executeSafeFormFixture(input: {
  projectId: string
  fixtureId: string
  startUrl: string
  allowLocalhost: boolean
}): Promise<SafeFormExecutionResult> {
  const fixture = await prisma.outcomeFixture.findFirst({
    where: { id: input.fixtureId, projectId: input.projectId, enabled: true },
  })
  if (!fixture?.authorizedAt) {
    return { disposition: 'BLOCKED', reason: 'fixture_not_authorized', detail: { fieldCount: 0, cleanupStatus: 'not_started' } }
  }
  const target = normalizeAuditUrl(input.startUrl)
  if (!target.ok || new URL(target.url).href !== new URL(fixture.targetUrl).href) {
    return { disposition: 'BLOCKED', reason: 'fixture_target_mismatch', detail: { fieldCount: 0, cleanupStatus: 'not_started' } }
  }
  const origin = new URL(target.url).origin
  const resetUrl = safeExactOrigin(fixture.resetUrl, origin)
  const cleanupUrl = safeExactOrigin(fixture.cleanupUrl, origin)
  if (!resetUrl || !cleanupUrl) {
    return { disposition: 'BLOCKED', reason: 'fixture_hook_origin_mismatch', detail: { fieldCount: 0, cleanupStatus: 'not_started' } }
  }

  const mapping = mappingSchema.safeParse(fixture.fieldMapping)
  const success = successSchema.safeParse(fixture.successCriterion)
  let values: z.infer<typeof valuesSchema>
  let hookSecret: string | null = null
  try {
    values = valuesSchema.parse(JSON.parse(decryptSecret(fixture.encryptedValues)))
    hookSecret = fixture.encryptedHookSecret ? decryptSecret(fixture.encryptedHookSecret) : null
  } catch {
    return { disposition: 'BLOCKED', reason: 'fixture_secret_unavailable', detail: { fieldCount: 0, cleanupStatus: 'not_started' } }
  }
  if (!mapping.success || !success.success || Object.keys(mapping.data.fields).some((key) => values[key] == null)) {
    return { disposition: 'BLOCKED', reason: 'fixture_configuration_invalid', detail: { fieldCount: 0, cleanupStatus: 'not_started' } }
  }
  if (!await callHook(resetUrl, hookSecret, fixture.id)) {
    return { disposition: 'BLOCKED', reason: 'fixture_reset_unproven', detail: { fieldCount: 0, cleanupStatus: 'not_started' } }
  }

  let disposition: SafeFormExecutionResult['disposition'] = 'BLOCKED'
  let reason = 'form_execution_failed'
  let cleanupStatus: SafeFormExecutionResult['detail']['cleanupStatus'] = 'not_started'
  const browser = await getBrowser()
  const session = await createAuditPage(browser, target.url, {
    profile: DESKTOP_CAPTURE_PROFILE,
    allowLocalhost: input.allowLocalhost,
  })
  try {
    for (const [key, selector] of Object.entries(mapping.data.fields)) {
      await session.page.locator(selector).first().fill(values[key]!)
    }
    await session.page.locator(mapping.data.submit).first().click({ timeout: 8_000 })
    const observedOrigin = new URL(session.page.url()).origin
    if (observedOrigin !== origin) {
      reason = 'form_left_authorized_origin'
    } else if (success.data.type === 'text') {
      const found = await session.page.getByText(success.data.value, { exact: false }).first().isVisible().catch(() => false)
      disposition = found ? 'SUCCEEDED' : 'FAILED'
      reason = found ? 'success_criterion_observed' : 'success_text_missing'
    } else if (success.data.type === 'selector') {
      const found = await session.page.locator(success.data.value).first().isVisible().catch(() => false)
      disposition = found ? 'SUCCEEDED' : 'FAILED'
      reason = found ? 'success_criterion_observed' : 'success_selector_missing'
    } else {
      const found = new URL(session.page.url()).href === new URL(success.data.value).href
      disposition = found ? 'SUCCEEDED' : 'FAILED'
      reason = found ? 'success_criterion_observed' : 'success_url_missing'
    }
  } catch {
    disposition = 'BLOCKED'
    reason = 'form_execution_failed'
  } finally {
    await session.page.context().close().catch(() => undefined)
    cleanupStatus = await callHook(cleanupUrl, hookSecret, fixture.id) ? 'succeeded' : 'failed'
  }
  if (cleanupStatus !== 'succeeded') {
    return { disposition: 'BLOCKED', reason: 'fixture_cleanup_unproven', detail: { fieldCount: Object.keys(mapping.data.fields).length, cleanupStatus } }
  }
  return { disposition, reason, detail: { fieldCount: Object.keys(mapping.data.fields).length, cleanupStatus } }
}
