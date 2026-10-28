import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { normalizeAuditUrl, normalizeAuditNavigationUrl } from '@/lib/audit/url'
import { prisma } from '@/lib/db'
import { requestSiteRun } from './run-requests'
import { readExecutionSpec } from '../domain/execution-spec'
import { encryptSecret } from '@/lib/security/crypto'
import { requireActiveAccountForWrite } from '@/lib/auth/account-availability'
import { fixtureOwnerCurrent } from '../domain/fixture-authority'
import { productTransaction } from '@/lib/billing/product-transaction'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import {
  safeFormExecutionResultSchema,
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
  setupRun?: { runId: string; auditId: string | null; version: number; state: string; reason: string | null } | null
}

export class OutcomeFixtureError extends Error {
  constructor(readonly code: string, message: string, readonly status = 400) {
    super(message)
    this.name = 'OutcomeFixtureError'
  }
}

const fixtureSelect = {
  id: true,
  configuredByUserId: true,
  project: { select: { userId: true } },
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
  const currentOwner = fixtureOwnerCurrent(row)
  return {
    id: row.id,
    name: row.name,
    targetUrl: row.targetUrl,
    fieldMapping: row.fieldMapping,
    successCriterion: row.successCriterion,
    resetUrl: row.resetUrl,
    cleanupUrl: row.cleanupUrl,
    version: row.version,
    lastDryRunVersion: currentOwner ? row.lastDryRunVersion : null,
    lastDryRunAt: currentOwner ? row.lastDryRunAt?.toISOString() ?? null : null,
    lastDryRunResult: currentOwner ? row.lastDryRunResult : null,
    authorizedAt: currentOwner ? row.authorizedAt?.toISOString() ?? null : null,
    enabled: row.enabled,
    hasValues: true,
    hasHookSecret: Boolean(row.encryptedHookSecret),
  }
}

function findFixture(projectId: string, fixtureId: string, db: Pick<Prisma.TransactionClient, 'outcomeFixture'> = prisma) {
  return db.outcomeFixture.findFirst({ where: { id: fixtureId, projectId }, select: fixtureSelect })
}

/** Keep lifecycle and Site identity stable through the complete fixture write. */
async function fixtureWrite<T>(projectId: string, userId: string, active: boolean,
  write: (tx: Prisma.TransactionClient, project: { id: string; url: string }) => Promise<T>) {
  return productTransaction(async tx => {
    if (active) await requireActiveAccountForWrite(tx, userId)
    else await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`
    const [project] = await tx.$queryRaw<Array<{ id: string; url: string }>>`
      SELECT id, url FROM projects WHERE id = ${projectId} AND "userId" = ${userId} AND "deletedAt" IS NULL FOR UPDATE`
    if (!project) throw new OutcomeFixtureError('SITE_NOT_FOUND', 'Site not found.', 404)
    return write(tx, project)
  })
}

function normalizeFixtureInput(siteUrl: string, input: OutcomeFixtureInput) {
  const site = normalizeAuditUrl(siteUrl)
  const target = normalizeAuditNavigationUrl(input.targetUrl)
  const reset = normalizeAuditUrl(input.resetUrl)
  const cleanup = normalizeAuditUrl(input.cleanupUrl)
  if (!site.ok || !target.ok || !reset.ok || !cleanup.ok) {
    throw new OutcomeFixtureError('FIXTURE_URL_INVALID', 'Use valid public HTTPS URLs for the form and its hooks.')
  }
  if ([target.url, reset.url, cleanup.url].some(url => new URL(url).protocol !== 'https:'))
    throw new OutcomeFixtureError('FIXTURE_HTTPS_REQUIRED', 'Use HTTPS for the Signup page and its reset and cleanup hooks.')
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
  const runs = await prisma.runRequest.findMany({ where: { projectId, executionSpec: { path: ['scope'], equals: 'FIXTURE_SETUP' } },
    orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }], take: 1000,
    select: { id: true, auditId: true, executionSpec: true, status: true, errorCode: true,
      audit: { select: { status: true, verifierExecutions: { where: { workKind: 'fixture-setup' }, take: 1,
        select: { workState: true, workErrorCode: true } } } } } })
  return rows.map(row => {
    const run = fixtureOwnerCurrent(row) ? runs.find(run => readExecutionSpec(run.executionSpec)?.fixtureSetup?.id === row.id &&
      readExecutionSpec(run.executionSpec)?.fixtureSetup?.version === row.version) : undefined
    const task = run?.audit?.verifierExecutions[0]
    return { ...toView(row), setupRun: run ? { runId: run.id, auditId: run.auditId, version: row.version,
      state: run.status === 'FAILED' || run.audit?.status === 'FAILED' ? 'FAILED' : task?.workState ?? run.status, reason: task?.workErrorCode ?? run.errorCode } : null }
  })
}

export async function createOutcomeFixture(input: {
  projectId: string
  userId: string
  fixture: OutcomeFixtureInput
}): Promise<OutcomeFixtureView> {
  return fixtureWrite(input.projectId, input.userId, true, async (tx, project) => {
    const data = normalizeFixtureInput(project.url, input.fixture)
    return toView(await tx.outcomeFixture.create({
      data: { projectId: project.id, configuredByUserId: input.userId, ...data, authorizedAt: null }, select: fixtureSelect,
    }))
  })
}

export async function updateOutcomeFixture(input: {
  projectId: string
  fixtureId: string
  userId: string
  fixture: OutcomeFixtureInput
}): Promise<OutcomeFixtureView> {
  return fixtureWrite(input.projectId, input.userId, true, async (tx, project) => {
    const current = await findFixture(input.projectId, input.fixtureId, tx)
    if (!current) throw new OutcomeFixtureError('FIXTURE_NOT_FOUND', 'Safe Form fixture not found.', 404)
    const data = normalizeFixtureInput(project.url, input.fixture)
    const row = await tx.outcomeFixture.update({
      where: { id: current.id },
      data: {
        ...data,
        configuredByUserId: input.userId,
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
  })
}

/** Setup is admitted durably. A disconnected HTTP caller does not own execution. */
export async function dryRunOutcomeFixture(input: {
  projectId: string; fixtureId: string; userId: string; idempotencyKey?: string;
}): Promise<OutcomeFixtureView> {
  const fixture = await findFixture(input.projectId, input.fixtureId)
  if (!fixture || fixture.project.userId !== input.userId)
    throw new OutcomeFixtureError('FIXTURE_NOT_FOUND', 'Safe Form fixture not found.', 404)
  if (!fixtureOwnerCurrent(fixture)) throw new OutcomeFixtureError('FIXTURE_CHANGED', SITE_ACTION_COPY.fixtures.configurationRequired, 409)
  const run = await requestSiteRun({ projectId: input.projectId, userId: input.userId, outcomeIds: [], source: 'WEB',
    scope: 'FIXTURE_SETUP', fixtureId: input.fixtureId, idempotencyKey: input.idempotencyKey })
  const views = await listOutcomeFixtures(input.projectId)
  const view = views.find(item => item.id === input.fixtureId)
  if (!view) throw new OutcomeFixtureError('FIXTURE_NOT_FOUND', 'Safe Form fixture not found.', 404)
  return { ...view, setupRun: view.setupRun ?? { runId: run.runId, auditId: run.auditId, version: fixture.version, state: 'QUEUED', reason: null } }
}

export async function authorizeOutcomeFixture(projectId: string, fixtureId: string, userId: string): Promise<OutcomeFixtureView> {
  return fixtureWrite(projectId, userId, true, async tx => {
    const fixture = await findFixture(projectId, fixtureId, tx)
    if (!fixture) throw new OutcomeFixtureError('FIXTURE_NOT_FOUND', 'Safe Form fixture not found.', 404)
    if (fixture.configuredByUserId !== userId) throw new OutcomeFixtureError('FIXTURE_CHANGED', SITE_ACTION_COPY.fixtures.configurationRequired, 409)
    const result = safeFormExecutionResultSchema.safeParse(fixture.lastDryRunResult)
    if (fixture.lastDryRunVersion !== fixture.version || !result.success || result.data.disposition !== 'SUCCEEDED' || result.data.detail.cleanupStatus !== 'succeeded') {
      throw new OutcomeFixtureError('FIXTURE_DRY_RUN_REQUIRED', 'Complete a successful dry run of this exact fixture version before authorizing it.', 409)
    }
    const changed = await tx.outcomeFixture.updateMany({
      where: {
        id: fixture.id,
        projectId,
        configuredByUserId: userId,
        version: fixture.version,
        lastDryRunVersion: fixture.version,
        lastDryRunResult: { path: ['disposition'], equals: 'SUCCEEDED' },
      },
      data: { authorizedAt: new Date(), enabled: true },
    })
    if (changed.count !== 1) {
      throw new OutcomeFixtureError('FIXTURE_CHANGED', 'The fixture changed before authorization. Run it again.', 409)
    }
    return toView(await findFixture(projectId, fixtureId, tx))
  })
}

export async function revokeOutcomeFixture(projectId: string, fixtureId: string, userId: string): Promise<OutcomeFixtureView> {
  return fixtureWrite(projectId, userId, false, async tx => {
    const fixture = await findFixture(projectId, fixtureId, tx)
    if (!fixture) throw new OutcomeFixtureError('FIXTURE_NOT_FOUND', 'Safe Form fixture not found.', 404)
    const row = await tx.outcomeFixture.update({
      where: { id: fixture.id },
      // Revocation invalidates pending setup consent as well as bound verification.
      data: { authorizedAt: null, version: { increment: 1 }, lastDryRunVersion: null, lastDryRunAt: null, lastDryRunResult: Prisma.DbNull },
      select: fixtureSelect,
    })
    return toView(row)
  })
}

export async function deleteOutcomeFixture(projectId: string, fixtureId: string, userId: string): Promise<void> {
  return fixtureWrite(projectId, userId, false, async tx => {
    const fixture = await findFixture(projectId, fixtureId, tx)
    if (!fixture) throw new OutcomeFixtureError('FIXTURE_NOT_FOUND', 'Safe Form fixture not found.', 404)
    const bindings = await tx.outcomeExecutionBinding.findMany({
      where: { mechanism: 'SAFE_FORM', outcome: { projectId } },
      select: { id: true, config: true },
    })
    const boundIds = bindings.filter((binding) => {
      const config = binding.config as { fixtureId?: unknown }
      return config.fixtureId === fixtureId
    }).map((binding) => binding.id)
    await tx.outcomeExecutionBinding.updateMany({ where: { id: { in: boundIds } }, data: { enabled: false } })
    await tx.outcomeFixture.delete({ where: { id: fixture.id } })
  })
}
