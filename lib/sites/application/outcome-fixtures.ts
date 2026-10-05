import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { normalizeAuditUrl } from '@/lib/audit/url'
import { prisma } from '@/lib/db'
import { encryptSecret } from '@/lib/security/crypto'
import {
  executeSafeFormFixture,
  safeFormMappingSchema,
  safeFormSuccessSchema,
  safeFormValuesSchema,
} from '@/lib/sites/application/safe-form-executor'

export const outcomeFixtureInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  targetUrl: z.string().url().max(2048),
  fieldMapping: safeFormMappingSchema,
  values: safeFormValuesSchema,
  successCriterion: safeFormSuccessSchema,
  resetUrl: z.string().url().max(2048),
  cleanupUrl: z.string().url().max(2048),
  hookSecret: z.string().max(2000).optional(),
})

export type OutcomeFixtureInput = z.infer<typeof outcomeFixtureInputSchema>

export type OutcomeFixtureView = {
  id: string
  name: string
  targetUrl: string
  fieldMapping: Prisma.JsonValue
  successCriterion: Prisma.JsonValue
  resetUrl: string
  cleanupUrl: string
  version: number
  lastDryRunVersion: number | null
  lastDryRunAt: string | null
  lastDryRunResult: Prisma.JsonValue | null
  authorizedAt: string | null
  enabled: boolean
  hasValues: true
  hasHookSecret: boolean
}

export class OutcomeFixtureError extends Error {
  constructor(readonly code: string, message: string, readonly status = 400) {
    super(message)
    this.name = 'OutcomeFixtureError'
  }
}

const fixtureSelect = {
  id: true,
  name: true,
  targetUrl: true,
  fieldMapping: true,
  encryptedValues: true,
  successCriterion: true,
  resetUrl: true,
  cleanupUrl: true,
  encryptedHookSecret: true,
  version: true,
  lastDryRunVersion: true,
  lastDryRunAt: true,
  lastDryRunResult: true,
  authorizedAt: true,
  enabled: true,
} as const

function toView(row: Awaited<ReturnType<typeof findFixture>>): OutcomeFixtureView {
  if (!row) throw new OutcomeFixtureError('FIXTURE_NOT_FOUND', 'Safe Form fixture not found.', 404)
  return {
    id: row.id,
    name: row.name,
    targetUrl: row.targetUrl,
    fieldMapping: row.fieldMapping,
    successCriterion: row.successCriterion,
    resetUrl: row.resetUrl,
    cleanupUrl: row.cleanupUrl,
    version: row.version,
    lastDryRunVersion: row.lastDryRunVersion,
    lastDryRunAt: row.lastDryRunAt?.toISOString() ?? null,
    lastDryRunResult: row.lastDryRunResult,
    authorizedAt: row.authorizedAt?.toISOString() ?? null,
    enabled: row.enabled,
    hasValues: true,
    hasHookSecret: Boolean(row.encryptedHookSecret),
  }
}

function findFixture(projectId: string, fixtureId: string) {
  return prisma.outcomeFixture.findFirst({ where: { id: fixtureId, projectId }, select: fixtureSelect })
}

function normalizeFixtureInput(siteUrl: string, input: OutcomeFixtureInput) {
  const site = normalizeAuditUrl(siteUrl)
  const target = normalizeAuditUrl(input.targetUrl)
  const reset = normalizeAuditUrl(input.resetUrl)
  const cleanup = normalizeAuditUrl(input.cleanupUrl)
  if (!site.ok || !target.ok || !reset.ok || !cleanup.ok) {
    throw new OutcomeFixtureError('FIXTURE_URL_INVALID', 'Use valid public HTTPS URLs for the form and its hooks.')
  }
  const siteOrigin = new URL(site.url).origin
  if ([target.url, reset.url, cleanup.url].some((url) => new URL(url).origin !== siteOrigin)) {
    throw new OutcomeFixtureError('FIXTURE_ORIGIN_MISMATCH', 'The form, reset hook, and cleanup hook must use this Site’s exact origin.')
  }
  const fieldKeys = Object.keys(input.fieldMapping.fields)
  const valueKeys = Object.keys(input.values)
  if (fieldKeys.length === 0 || fieldKeys.some((key) => !valueKeys.includes(key)) || valueKeys.some((key) => !fieldKeys.includes(key))) {
    throw new OutcomeFixtureError('FIXTURE_FIELDS_INVALID', 'Every configured field needs exactly one synthetic value.')
  }
  return {
    name: input.name,
    targetUrl: target.url,
    fieldMapping: input.fieldMapping,
    encryptedValues: encryptSecret(JSON.stringify(input.values)),
    successCriterion: input.successCriterion,
    resetUrl: reset.url,
    cleanupUrl: cleanup.url,
    encryptedHookSecret: input.hookSecret ? encryptSecret(input.hookSecret) : null,
  }
}

export async function listOutcomeFixtures(projectId: string): Promise<OutcomeFixtureView[]> {
  const rows = await prisma.outcomeFixture.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
    select: fixtureSelect,
  })
  return rows.map((row) => toView(row))
}

export async function createOutcomeFixture(input: {
  projectId: string
  siteUrl: string
  fixture: OutcomeFixtureInput
}): Promise<OutcomeFixtureView> {
  const data = normalizeFixtureInput(input.siteUrl, input.fixture)
  const row = await prisma.outcomeFixture.create({
    data: { projectId: input.projectId, ...data, authorizedAt: null },
    select: fixtureSelect,
  })
  return toView(row)
}

export async function updateOutcomeFixture(input: {
  projectId: string
  fixtureId: string
  siteUrl: string
  fixture: OutcomeFixtureInput
}): Promise<OutcomeFixtureView> {
  const current = await findFixture(input.projectId, input.fixtureId)
  if (!current) throw new OutcomeFixtureError('FIXTURE_NOT_FOUND', 'Safe Form fixture not found.', 404)
  const data = normalizeFixtureInput(input.siteUrl, input.fixture)
  const row = await prisma.outcomeFixture.update({
    where: { id: current.id },
    data: {
      ...data,
      version: { increment: 1 },
      lastDryRunVersion: null,
      lastDryRunAt: null,
      lastDryRunResult: Prisma.DbNull,
      authorizedAt: null,
      enabled: true,
    },
    select: fixtureSelect,
  })
  return toView(row)
}

export async function dryRunOutcomeFixture(input: {
  projectId: string
  fixtureId: string
}): Promise<OutcomeFixtureView> {
  const fixture = await findFixture(input.projectId, input.fixtureId)
  if (!fixture) throw new OutcomeFixtureError('FIXTURE_NOT_FOUND', 'Safe Form fixture not found.', 404)
  const result = await executeSafeFormFixture({
    projectId: input.projectId,
    fixtureId: input.fixtureId,
    startUrl: fixture.targetUrl,
    allowLocalhost: false,
    requireAuthorization: false,
  })
  const now = new Date()
  const updated = await prisma.outcomeFixture.updateMany({
    where: { id: fixture.id, projectId: input.projectId, version: fixture.version },
    data: {
      lastDryRunVersion: fixture.version,
      lastDryRunAt: now,
      lastDryRunResult: result,
      authorizedAt: null,
    },
  })
  if (updated.count !== 1) throw new OutcomeFixtureError('FIXTURE_CHANGED', 'The fixture changed during its dry run. Run it again.', 409)
  return toView(await findFixture(input.projectId, input.fixtureId))
}

export async function authorizeOutcomeFixture(projectId: string, fixtureId: string): Promise<OutcomeFixtureView> {
  const fixture = await findFixture(projectId, fixtureId)
  if (!fixture) throw new OutcomeFixtureError('FIXTURE_NOT_FOUND', 'Safe Form fixture not found.', 404)
  const result = fixture.lastDryRunResult as { disposition?: unknown } | null
  if (fixture.lastDryRunVersion !== fixture.version || result?.disposition !== 'SUCCEEDED') {
    throw new OutcomeFixtureError('FIXTURE_DRY_RUN_REQUIRED', 'Complete a successful dry run of this exact fixture version before authorizing it.', 409)
  }
  const changed = await prisma.outcomeFixture.updateMany({
    where: {
      id: fixture.id,
      projectId,
      version: fixture.version,
      lastDryRunVersion: fixture.version,
    },
    data: { authorizedAt: new Date(), enabled: true },
  })
  if (changed.count !== 1) {
    throw new OutcomeFixtureError('FIXTURE_CHANGED', 'The fixture changed before authorization. Run it again.', 409)
  }
  return toView(await findFixture(projectId, fixtureId))
}

export async function revokeOutcomeFixture(projectId: string, fixtureId: string): Promise<OutcomeFixtureView> {
  const fixture = await findFixture(projectId, fixtureId)
  if (!fixture) throw new OutcomeFixtureError('FIXTURE_NOT_FOUND', 'Safe Form fixture not found.', 404)
  const row = await prisma.outcomeFixture.update({
    where: { id: fixture.id },
    data: { authorizedAt: null },
    select: fixtureSelect,
  })
  return toView(row)
}

export async function deleteOutcomeFixture(projectId: string, fixtureId: string): Promise<void> {
  const fixture = await findFixture(projectId, fixtureId)
  if (!fixture) throw new OutcomeFixtureError('FIXTURE_NOT_FOUND', 'Safe Form fixture not found.', 404)
  const bindings = await prisma.outcomeExecutionBinding.findMany({
    where: { mechanism: 'SAFE_FORM', outcome: { projectId } },
    select: { id: true, config: true },
  })
  const boundIds = bindings.filter((binding) => {
    const config = binding.config as { fixtureId?: unknown }
    return config.fixtureId === fixtureId
  }).map((binding) => binding.id)
  await prisma.$transaction([
    prisma.outcomeExecutionBinding.updateMany({ where: { id: { in: boundIds } }, data: { enabled: false } }),
    prisma.outcomeFixture.delete({ where: { id: fixture.id } }),
  ])
}
