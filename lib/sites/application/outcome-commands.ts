import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import type { SiteRecord } from '@/lib/sites/types'
import { createHash } from 'node:crypto'
import { executionTransaction, executionWrite } from '@/lib/audit/execution-ownership'
import { SiteRunRefusal } from './run-refusal'
import type { SiteOutcomeView } from '@/lib/sites/presentation/outcome-view'
import type { SiteOutcomeDetailView } from '@/lib/sites/presentation/outcome-detail-view'
import { expectationForKind, nameForConfirmedOutcomeKind, type ConfirmableOutcomeKind } from '@/lib/sites/outcome-kinds'
import { bindingForConfirmedKind } from './outcome-bindings'
import { toOutcomeView, loadSiteOutcomeDetail } from './outcome-queries'

/** Confirm that the walked page should stay available. Does not invent a purchase path. */
export async function confirmPageAvailability(site: SiteRecord): Promise<SiteOutcomeView | null> {
  if (!site.projectId && !site.provisionalSiteId) return null
  const slug = 'page-loads'
  const where: Prisma.SiteOutcomeWhereUniqueInput = site.projectId
    ? { projectId_slug: { projectId: site.projectId, slug } }
    : { provisionalSiteId_slug: { provisionalSiteId: site.provisionalSiteId!, slug } }
  const owner = site.projectId
    ? { projectId: site.projectId }
    : { provisionalSiteId: site.provisionalSiteId! }
  const row = await executionWrite(tx => tx.siteOutcome.upsert({
    where,
    create: {
      ...owner,
      name: 'This page loads',
      slug,
      description: 'The public page responds successfully.',
      kind: 'AVAILABILITY',
      criticality: 'IMPORTANT',
      expectation: expectationForKind('AVAILABILITY'),
      inferenceSource: 'browser',
    },
    update: {},
  }))
  return confirmSiteOutcome({
    site,
    outcomeId: row.id,
    confirmed: true,
    kind: 'AVAILABILITY',
    name: row.inferenceSource === 'user' ? row.name : 'This page loads',
  })
}

export async function confirmSiteOutcome(input: {
  site: SiteRecord
  outcomeId: string
  name?: string
  confirmed: boolean
  kind?: ConfirmableOutcomeKind
  fixtureId?: string
  targetUrl?: string
}): Promise<SiteOutcomeView | null> {
  const ownerFilter =
    input.site.kind === 'project'
      ? { projectId: input.site.projectId! }
      : { provisionalSiteId: input.site.provisionalSiteId! }

  let safeFixture: { id: string; targetUrl: string } | undefined
  if (input.confirmed && input.kind === 'SIGNUP') {
    if (!input.site.projectId || !input.fixtureId) throw new OutcomeFixtureRequiredError()
    const fixture = await prisma.outcomeFixture.findFirst({
      where: { id: input.fixtureId, projectId: input.site.projectId, enabled: true, authorizedAt: { not: null } },
      select: { id: true, targetUrl: true, version: true, lastDryRunVersion: true },
    })
    if (!fixture || fixture.lastDryRunVersion !== fixture.version) throw new OutcomeFixtureRequiredError()
    safeFixture = { id: fixture.id, targetUrl: fixture.targetUrl }
  }

  const updated = await executionTransaction(async (tx) => {
    // Every confirmation, reconfirmation and withdrawal for one Outcome must
    // observe the previous mutation after it commits. Without this row lock, a
    // withdrawal can scan bindings before a concurrent confirmation inserts
    // one, then win the confirmedAt write while leaving that binding enabled.
    const ownerPredicate = input.site.kind === 'project'
      ? Prisma.sql`"projectId" = ${input.site.projectId!}`
      : Prisma.sql`"provisionalSiteId" = ${input.site.provisionalSiteId!}`
    const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "site_outcomes"
      WHERE "id" = ${input.outcomeId}
        AND ${ownerPredicate}
      FOR UPDATE
    `)
    if (locked.length === 0) return null
    const outcome = await tx.siteOutcome.findFirst({
      where: { id: input.outcomeId, ...ownerFilter },
      select: { id: true, name: true, kind: true, confirmedAt: true },
    })
    if (!outcome) return null

    if (input.confirmed && input.kind) {
      if (outcome.kind !== 'GENERIC' && outcome.kind !== input.kind) {
        throw new OutcomeKindMismatchError(outcome.kind, input.kind)
      }

      const binding = bindingForConfirmedKind(input.kind, input.targetUrl ?? input.site.url, safeFixture)
      if (!binding) throw new OutcomeFixtureRequiredError()
      // One Outcome has one active semantic identity. Legacy or interrupted
      // writes may have left another binding enabled, so retire it in the same
      // transaction that installs the binding matching the agreed kind.
      await tx.outcomeExecutionBinding.updateMany({
        where: { outcomeId: outcome.id, key: { not: binding.key }, enabled: true },
        data: { enabled: false },
      })
      await tx.outcomeExecutionBinding.upsert({
        where: { outcomeId_key: { outcomeId: outcome.id, key: binding.key } },
        create: { outcomeId: outcome.id, ...binding },
        update: {
          enabled: true,
          required: binding.required,
          mechanism: binding.mechanism,
          config: binding.config,
          scope: binding.scope,
        },
      })
    } else if (!input.confirmed) {
      // Withdrawing the agreement also stops its execution. Leaving an enabled
      // binding behind would let unattended Watch keep exercising an Outcome
      // the customer explicitly stopped confirming.
      await tx.outcomeExecutionBinding.updateMany({
        where: { outcomeId: outcome.id, enabled: true },
        data: { enabled: false },
      })
    }

    const semanticWhere: Prisma.SiteOutcomeWhereInput = input.confirmed && input.kind
      ? { kind: { in: ['GENERIC', input.kind] } }
      : {}
    const changed = await tx.siteOutcome.updateMany({
      where: { id: outcome.id, ...ownerFilter, ...semanticWhere },
      data: {
        // Classification gives a generic inference its canonical executable
        // meaning once. A repeated same-kind request is stale/idempotent input,
        // not permission to erase the customer's later rename.
        ...(input.confirmed && input.kind && outcome.kind === 'GENERIC'
          ? { name: nameForConfirmedOutcomeKind(input.kind) }
          : !input.confirmed && input.name?.trim()
            ? { name: input.name.trim() }
            : {}),
        inferenceSource: 'user',
        confirmedAt: input.confirmed ? outcome.confirmedAt ?? new Date() : null,
        ...(input.confirmed && input.kind
          ? {
              kind: input.kind,
              criticality: input.kind === 'CHECKOUT' ? 'CRITICAL' as const : 'IMPORTANT' as const,
              expectation: expectationForKind(input.kind),
            }
          : {}),
      },
    })
    // This also closes the concurrent reclassification race: if another writer
    // changed the kind after our read, throwing rolls back the binding writes.
    if (changed.count !== 1) {
      throw new OutcomeKindMismatchError(outcome.kind, input.kind ?? outcome.kind)
    }

    return tx.siteOutcome.findUniqueOrThrow({
      where: { id: outcome.id },
      include: {
        pages: true,
        bindings: { where: { enabled: true }, select: { key: true, required: true, scope: true, mechanism: true, version: true, config: true } },
        assessments: { orderBy: [{ runRequest: { requestedAt: 'desc' } }, { assessedAt: 'desc' }], take: 1 },
        runSelections: { include: { runRequest: true }, orderBy: { runRequest: { requestedAt: 'desc' } }, take: 1 },
      },
    })
  })

  return updated ? toOutcomeView(updated) : null
}

/** Owner creation uses the same confirmation and binding contract as inferred Outcomes. */
export async function createSiteOutcome(input: {
  site: SiteRecord; kind: 'AVAILABILITY' | 'SIGNUP'; targetUrl: string; fixtureId?: string
}): Promise<SiteOutcomeView | null> {
  if (!input.site.projectId) throw new SiteRunRefusal('Claim this Site first.', 403)
  const target = new URL(input.targetUrl)
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password || target.origin !== new URL(input.site.url).origin) {
    throw new SiteRunRefusal('Choose a page on this website’s exact origin.', 400)
  }
  target.hash = ''
  if (input.kind === 'SIGNUP') {
    const fixture = await prisma.outcomeFixture.findFirst({
      where: { id: input.fixtureId ?? '', projectId: input.site.projectId, enabled: true, authorizedAt: { not: null } },
      select: { version: true, lastDryRunVersion: true, targetUrl: true },
    })
    if (!fixture || fixture.version !== fixture.lastDryRunVersion || fixture.targetUrl !== target.toString()) throw new OutcomeFixtureRequiredError()
  }
  const slug = `${input.kind.toLowerCase()}-${createHash('sha256').update(target.toString()).digest('hex').slice(0, 24)}`
  const projectId = input.site.projectId
  const row = await executionWrite(tx => tx.siteOutcome.upsert({
    where: { projectId_slug: { projectId, slug } },
    create: { projectId: input.site.projectId, slug, name: nameForConfirmedOutcomeKind(input.kind), kind: input.kind,
      expectation: expectationForKind(input.kind), inferenceSource: 'user' },
    update: {},
  }))
  return confirmSiteOutcome({ site: input.site, outcomeId: row.id, confirmed: true, kind: input.kind, fixtureId: input.fixtureId, targetUrl: target.toString() })
}

export class OutcomeKindMismatchError extends Error {
  constructor(readonly existingKind: string, readonly requestedKind: string) {
    super(`Outcome kind ${existingKind} cannot be changed to ${requestedKind}`)
    this.name = 'OutcomeKindMismatchError'
  }
}

export class OutcomeFixtureRequiredError extends Error {
  constructor() {
    super('A current, authorized Safe Form fixture is required for Signup.')
    this.name = 'OutcomeFixtureRequiredError'
  }
}

/** Rename only the customer-visible label; preserve the agreement and proof. */
export async function renameSiteOutcome(input: {
  site: SiteRecord
  outcomeId: string
  name: string
}): Promise<SiteOutcomeView | null> {
  const ownerFilter =
    input.site.kind === 'project'
      ? { projectId: input.site.projectId! }
      : { provisionalSiteId: input.site.provisionalSiteId! }
  const outcome = await prisma.siteOutcome.findFirst({
    where: { id: input.outcomeId, ...ownerFilter },
    select: { id: true },
  })
  if (!outcome) return null

  const updated = await executionWrite(tx => tx.siteOutcome.update({
    where: { id: outcome.id },
    data: { name: input.name.trim(), inferenceSource: 'user' },
    include: {
      pages: true,
      bindings: { where: { enabled: true }, select: { key: true, required: true, scope: true, mechanism: true, version: true, config: true } },
      assessments: { orderBy: [{ runRequest: { requestedAt: 'desc' } }, { assessedAt: 'desc' }], take: 1 },
      runSelections: { include: { runRequest: true }, orderBy: { runRequest: { requestedAt: 'desc' } }, take: 1 },
    },
  }))
  return toOutcomeView(updated)
}

export async function setSiteOutcomeEnabled(input: {
  site: SiteRecord
  outcomeId: string
  enabled: boolean
}): Promise<SiteOutcomeDetailView | null> {
  if (!input.site.projectId) return null
  const changed = await executionWrite(tx => tx.siteOutcome.updateMany({
    where: { id: input.outcomeId, projectId: input.site.projectId },
    data: { enabled: input.enabled },
  }))
  if (changed.count !== 1) return null
  return loadSiteOutcomeDetail(input.site, input.outcomeId)
}
