import { discoverOutcomePages, discoverJourneyOutcomes } from '@/lib/sites/domain/outcome-discovery'
import { projectOutcomeDetail, type SiteOutcomeDetailView } from '@/lib/sites/presentation/outcome-detail-view'
import { projectOutcomeView, type OutcomeViewSource, type SiteOutcomeView } from '@/lib/sites/presentation/outcome-view'
export type { SiteOutcomeView } from '@/lib/sites/presentation/outcome-view'
import { executionTransaction, executionWrite } from '@/lib/audit/execution-ownership'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { createHash } from 'node:crypto'
import { SiteRunRefusal } from '@/lib/sites/application/run-refusal'
import type { SiteRecord } from '@/lib/sites/types'
import { recordSiteLifecycleEvent } from '@/lib/analytics/site-events'
import { observedPurchaseStart } from '@/lib/sites/checkout-inference'
import { type CurrentBindingRevision } from '@/lib/sites/domain/assessment-comparability'
import { loadOutcomeBindingRevisions } from '@/lib/sites/application/outcome-binding-revisions'
import { validateBindingForOutcome } from '@/lib/sites/application/binding-config'
import type { BrowserJourneyConfig } from '@/lib/sites/application/binding-config'
import {
  CONFIRMABLE_OUTCOME_KINDS,
  expectationForKind,
  nameForConfirmedOutcomeKind,
  type ConfirmableOutcomeKind,
} from '@/lib/sites/outcome-kinds'

export { CONFIRMABLE_OUTCOME_KINDS, nameForConfirmedOutcomeKind, type ConfirmableOutcomeKind }

function buildCheckoutJourneyConfig(startUrl: string, allowLocalhost: boolean): BrowserJourneyConfig {
  return {
    startUrl,
    steps: [{ action: 'wait', waitMs: 1_000 }],
    goal: { type: 'url_pattern', pattern: '/checkouts?(/|$|\\?)', description: 'Reach the checkout page' },
    safety: 'stop-at-checkout',
    allowLocalhost,
  }
}

export function bindingForConfirmedKind(
  kind: ConfirmableOutcomeKind,
  siteUrl: string,
  fixture?: { id: string; targetUrl: string },
) {
  if (kind === 'CHECKOUT') {
    return {
      key: 'checkout-browser-v1',
      mechanism: 'BROWSER_JOURNEY' as const,
      config: {
        startUrl: siteUrl,
        steps: [{ action: 'wait', waitMs: 1_000 }],
        goal: { type: 'url_pattern' as const, pattern: '/checkouts?(/|$|\\?)', description: 'Reach the checkout page' },
        safety: 'stop-at-checkout' as const,
      },
      scope: { device: 'mobile', expected: 'checkout_reached' },
      required: true,
    }
  }
  if (kind === 'SIGNUP') {
    return {
      key: 'signup-safe-form-v1',
      mechanism: 'SAFE_FORM' as const,
      config: {
        startUrl: fixture?.targetUrl ?? siteUrl,
        safety: 'reversible' as const,
        authorized: true as const,
        fixtureId: fixture?.id ?? '',
      },
      scope: { device: 'desktop', expected: 'signup_completed' },
      required: true,
    }
  }
  if (kind === 'LOGIN' || kind === 'PASSWORD_RESET') return null
  return {
    key: 'page-availability-v1',
    mechanism: 'HTTP_AVAILABILITY' as const,
    config: { startUrl: siteUrl, expectedSelector: 'body' },
    required: true,
  }
}

/**
 * Whether FixFlags can keep a promise about this kind, derived from the
 * execution contract rather than asserted next to it.
 *
 * This is the question the confirmation command has to answer, and it has to be
 * derived, because the failure it prevents is precisely a disagreement between
 * two modules. Interactive browser bindings must either stop at checkout or use
 * an explicitly authorized reversible fixture. Signup has that tenant-scoped
 * contract. Login and Password reset remain unavailable until they can meet the
 * same standard.
 *
 * When a real fixture path lands and the config validates, this returns true and
 * the refusal disappears on its own. That is the intended way for it to change.
 */
export function outcomeKindWatchable(
  kind: ConfirmableOutcomeKind,
  siteUrl = 'https://example.com',
  fixture?: { id: string; targetUrl: string },
): boolean {
  const binding = bindingForConfirmedKind(kind, siteUrl, fixture)
  if (!binding) return false
  return validateBindingForOutcome(kind, binding.mechanism, binding.config).success
}

async function pageUrlsForIds(pageIds: string[]): Promise<string[]> {
  if (pageIds.length === 0) return []
  const pages = await prisma.sitePage.findMany({
    where: { id: { in: pageIds } },
    select: { id: true, url: true },
  })
  const byId = new Map(pages.map((p) => [p.id, p.url]))
  return pageIds.map((id) => byId.get(id)).filter((url): url is string => Boolean(url))
}

async function toOutcomeView(row: OutcomeViewSource, bindingRevisions?: CurrentBindingRevision[]): Promise<SiteOutcomeView> {
  const revisions = bindingRevisions ?? (row.assessments[0] ? (await loadOutcomeBindingRevisions([row]))[0] : [])
  const pageUrls = await pageUrlsForIds(row.pages.map(page => page.pageId))
  return projectOutcomeView(row, { bindingRevisions: revisions, pageUrls, now: new Date() })
}

/** Worker projection: only observed pages and browser-planned journeys become Site facts. */
export async function syncOutcomesFromAudit(input: {
  site: SiteRecord
  auditId: string
  url: string
}): Promise<void> {
  const audit = await prisma.audit.findUniqueOrThrow({
    where: { id: input.auditId },
    select: {
      projectId: true,
      pages: { select: { url: true, title: true } },
      flags: { select: { checkId: true, pageUrl: true } },
      journeyReviews: {
        select: {
          journeyType: true,
          startUrl: true,
          steps: { select: { url: true, actionType: true, actionDetail: true, elementDescription: true } },
        },
      },
    },
  })
  if (audit.projectId !== input.site.projectId)
    throw new Error('Analysis does not belong to this Site')
  let checkoutOutcomeId: string | null = null
  await executionTransaction(async (tx) => {
    const owner = input.site.projectId
      ? { projectId: input.site.projectId }
      : { provisionalSiteId: input.site.provisionalSiteId! }
    const pages = new Map<string, string>()
    for (const { rawUrl, url: pageUrl, path, title } of discoverOutcomePages(input.site.url, audit)) {
      const where: Prisma.SitePageWhereUniqueInput = input.site.projectId
        ? { projectId_url: { projectId: input.site.projectId, url: pageUrl } }
        : {
            provisionalSiteId_url: {
              provisionalSiteId: input.site.provisionalSiteId!,
              url: pageUrl,
            },
          }
      const page = await tx.sitePage.upsert({
        where,
        create: { ...owner, url: pageUrl, path, title },
        update: { title },
      })
      pages.set(rawUrl, page.id)
    }
    for (const { kind, name, slug, urls } of discoverJourneyOutcomes(audit.journeyReviews)) {
      const where: Prisma.SiteOutcomeWhereUniqueInput = input.site.projectId
        ? { projectId_slug: { projectId: input.site.projectId, slug } }
        : {
            provisionalSiteId_slug: {
              provisionalSiteId: input.site.provisionalSiteId!,
              slug,
            },
          }
      // Never overwrite a user's label, confirmation, or deliberately edited intent.
      const outcome = await tx.siteOutcome.upsert({
        where,
        create: { ...owner, name, slug, kind, inferenceSource: 'browser' },
        update: {},
      })
      if (outcome.inferenceSource === 'user') continue
      const pageIds = new Set(
        urls
          .map((url) => pages.get(url))
          .filter((id): id is string => Boolean(id)),
      )
      for (const pageId of pageIds) {
        await tx.siteOutcomePage.upsert({
          where: { outcomeId_pageId: { outcomeId: outcome.id, pageId } },
          create: { outcomeId: outcome.id, pageId },
          update: {},
        })
      }
    }

    const linkedPath = input.site.projectId
      ? await tx.revenuePath.findFirst({
          where: {
            shop: { projectId: input.site.projectId, uninstalledAt: null },
          },
          orderBy: { updatedAt: 'desc' },
          select: { storefrontUrl: true },
        })
      : null
    const startUrl = observedPurchaseStart({
      siteUrl: input.site.url,
      pageUrls: [
        ...audit.pages.map((page) => page.url),
        ...audit.journeyReviews.flatMap((journey) => [
          journey.startUrl,
          ...journey.steps.map((step) => step.url),
        ]),
      ],
      flags: audit.flags,
      steps: audit.journeyReviews.flatMap((journey) => journey.steps),
      storefrontUrl: linkedPath?.storefrontUrl,
    })
    if (startUrl) {
      const where: Prisma.SiteOutcomeWhereUniqueInput = input.site.projectId
        ? {
            projectId_slug: {
              projectId: input.site.projectId,
              slug: 'checkout',
            },
          }
        : {
            provisionalSiteId_slug: {
              provisionalSiteId: input.site.provisionalSiteId!,
              slug: 'checkout',
            },
          }
      const existing = await tx.siteOutcome.findUnique({
        where,
        select: { inferenceSource: true, confirmedAt: true },
      })
      // A customer-owned Checkout keeps its label and start. Analysis must not replace it.
      if (existing?.inferenceSource !== 'user' && !existing?.confirmedAt) {
        const checkout = await tx.siteOutcome.upsert({
          where,
          create: {
            ...owner,
            name: 'Checkout',
            slug: 'checkout',
            description: 'A customer can add a product and reach checkout.',
            kind: 'CHECKOUT',
            criticality: 'CRITICAL',
            expectation: 'The selected product appears in the cart and checkout opens.',
            inferenceSource: 'browser',
            confirmedAt: new Date(),
          },
          update: {
            kind: 'CHECKOUT',
            criticality: 'CRITICAL',
            expectation: 'The selected product appears in the cart and checkout opens.',
            confirmedAt: new Date(),
          },
        })
        checkoutOutcomeId = checkout.id
        const bindingConfig = buildCheckoutJourneyConfig(startUrl, false)
        await tx.outcomeExecutionBinding.upsert({
          where: {
            outcomeId_key: { outcomeId: checkout.id, key: 'checkout-browser-v1' },
          },
          create: {
            outcomeId: checkout.id,
            mechanism: 'BROWSER_JOURNEY',
            key: 'checkout-browser-v1',
            config: bindingConfig,
            scope: { device: 'mobile', expected: 'checkout_reached' },
            required: true,
          },
          update: { config: bindingConfig },
        })
      }
    }
  })
  if (checkoutOutcomeId && input.site.projectId) {
    await recordSiteLifecycleEvent({
      name: 'outcome_created',
      idempotencyKey: `outcome-created:${checkoutOutcomeId}`,
      userId: input.site.userId,
      projectId: input.site.projectId,
      properties: { kind: 'checkout', inference: 'browser' },
    }).catch(() => undefined)
  }
}

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

export async function listSiteOutcomes(site: SiteRecord): Promise<SiteOutcomeView[]> {
  const ownerFilter =
    site.kind === 'project'
      ? { projectId: site.projectId! }
      : { provisionalSiteId: site.provisionalSiteId! }

  const rows = await prisma.siteOutcome.findMany({
    where: ownerFilter,
    include: {
      pages: true,
      bindings: { where: { enabled: true }, select: { key: true, required: true, scope: true, mechanism: true, version: true, config: true } },
      assessments: { orderBy: [{ runRequest: { requestedAt: 'desc' } }, { assessedAt: 'desc' }], take: 1 },
      runSelections: { include: { runRequest: true }, orderBy: { runRequest: { requestedAt: 'desc' } }, take: 1 },
    },
    orderBy: { createdAt: 'asc' },
  })

  const revisions = await loadOutcomeBindingRevisions(rows)
  return Promise.all(rows.map((row, index) => toOutcomeView(row, revisions[index])))
}

export type { SiteOutcomeDetailView } from '@/lib/sites/presentation/outcome-detail-view'

export async function loadSiteOutcomeDetail(
  site: SiteRecord,
  outcomeId: string,
): Promise<SiteOutcomeDetailView | null> {
  const ownerFilter = site.kind === 'project'
    ? { projectId: site.projectId! }
    : { provisionalSiteId: site.provisionalSiteId! }
  const row = await prisma.siteOutcome.findFirst({
    where: { id: outcomeId, ...ownerFilter },
    include: {
      pages: true,
      bindings: { where: { enabled: true }, select: { key: true, required: true, scope: true, mechanism: true, version: true, config: true } },
      assessments: { orderBy: [{ runRequest: { requestedAt: 'desc' } }, { assessedAt: 'desc' }], take: 20 },
      runSelections: { include: { runRequest: true }, orderBy: { runRequest: { requestedAt: 'desc' } }, take: 20 },
      bindingAttempts: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
  })
  if (!row) return null
  const [revisions] = await loadOutcomeBindingRevisions([row])
  const view = await toOutcomeView(row, revisions)
  const [executions, lastSuccessful, improvements] = await Promise.all([
    prisma.outcomeBindingExecution.findMany({
      where: { outcomeId: row.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { audit: { select: { executionSpec: true } } },
    }),
    prisma.outcomeAssessment.findFirst({
      where: { outcomeId: row.id, state: 'CLEAR' },
      orderBy: { assessedAt: 'desc' },
      select: { assessedAt: true },
    }),
    site.projectId ? prisma.improvement.findMany({
      where: { projectId: site.projectId, outcomeId: row.id },
      select: {
        id: true,
        title: true,
        occurrences: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: { id: true, kind: true, createdAt: true, auditId: true },
        },
        attempts: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            createdAt: true,
            changeSummary: true,
            outcome: true,
            verificationReason: true,
            sourceAuditId: true,
            verificationAuditId: true,
          },
        },
      },
    }) : Promise.resolve([]),
  ])
  return projectOutcomeDetail({ row, view, revisions, executions, lastSuccessful, improvements }, new Date())
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
