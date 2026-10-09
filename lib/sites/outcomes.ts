import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { createHash } from 'node:crypto'
import { SiteRunRefusal } from '@/lib/sites/application/run-refusal'
import type { SiteRecord } from '@/lib/sites/types'
import { recordSiteLifecycleEvent } from '@/lib/analytics/site-events'
import { observedPurchaseStart } from '@/lib/sites/checkout-inference'
import { OUTCOME_DETAIL_COPY } from '@/lib/marketing/copy/workspace'
import { availabilityCouldNotVerifyRecovery, checkoutCouldNotVerifyRecovery, currentOutcomeState, customerBindingResult, outcomeStatusLabel, staleOutcomeRecovery, UNASSESSED_OUTCOME_SUMMARY, type CustomerOutcomeState } from '@/lib/sites/outcome-state'
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

/** The kinds a customer may be offered right now, in the order they are offered. */
function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 64) || 'outcome'
  )
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

async function toOutcomeView(row: {
  id: string
  name: string
  slug: string
  description: string | null
  inferenceSource: string
  confirmedAt: Date | null
  pages: Array<{ pageId: string }>
  kind: 'GENERIC' | 'CHECKOUT' | 'SIGNUP' | 'LOGIN' | 'PASSWORD_RESET' | 'AVAILABILITY'
  criticality: 'CRITICAL' | 'IMPORTANT' | 'INFORMATIONAL'
  environment: string
  enabled: boolean
  staleAfterMinutes: number
  expectation: string | null
  bindings: Array<{ key: string; required: boolean; scope: Prisma.JsonValue | null; mechanism: string; version: number }>
  assessments: Array<{
    state: 'CLEAR' | 'FLAG' | 'COULD_NOT_VERIFY'
    summary: string
    assessedAt: Date
    validUntil: Date
    improvementId: string | null
    runRequestId: string
    coverage: Prisma.JsonValue | null
  }>
  runSelections: Array<{ runRequest: { id: string; status: string } }>
}): Promise<SiteOutcomeView> {
  const pageIds = row.pages.map((p) => p.pageId)
  const latest = row.assessments[0] ?? null
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    inferenceSource:
      row.inferenceSource === 'user'
        ? 'user'
        : row.inferenceSource === 'browser'
          ? 'browser'
          : 'heuristic',
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    pageIds,
    pageUrls: await pageUrlsForIds(pageIds),
    kind: row.kind,
    criticality: row.criticality,
    environment: row.environment,
    enabled: row.enabled,
    staleAfterMinutes: row.staleAfterMinutes,
    expectation: row.expectation,
    bindings: row.bindings.map((binding) => ({
      key: binding.key,
      required: binding.required,
      scope: binding.scope,
      mechanism: binding.mechanism,
      version: binding.version,
    })),
    coverage: latest?.coverage ?? null,
    state: currentOutcomeState(latest),
    summary: latest?.summary ?? UNASSESSED_OUTCOME_SUMMARY,
    lastVerifiedAt: latest?.assessedAt.toISOString() ?? null,
    validUntil: latest?.validUntil.toISOString() ?? null,
    flagId: latest?.improvementId ?? null,
    latestRunId: row.runSelections[0]?.runRequest.id ?? latest?.runRequestId ?? null,
    running: row.runSelections.some(
      ({ runRequest }) => runRequest.status === 'QUEUED' || runRequest.status === 'RUNNING',
    ),
  }
}

export type SiteOutcomeView = {
  id: string
  name: string
  slug: string
  description: string | null
  inferenceSource: 'heuristic' | 'browser' | 'user'
  confirmedAt: string | null
  pageIds: string[]
  pageUrls: string[]
  kind: 'GENERIC' | 'CHECKOUT' | 'SIGNUP' | 'LOGIN' | 'PASSWORD_RESET' | 'AVAILABILITY'
  criticality: 'CRITICAL' | 'IMPORTANT' | 'INFORMATIONAL'
  environment: string
  enabled: boolean
  staleAfterMinutes: number
  expectation: string | null
  bindings: Array<{ key: string; required: boolean; scope: Prisma.JsonValue | null; mechanism: string; version: number }>
  coverage: Prisma.JsonValue | null
  state: CustomerOutcomeState
  summary: string
  lastVerifiedAt: string | null
  validUntil: string | null
  flagId: string | null
  latestRunId: string | null
  running: boolean
}

/** Classify a journey type into a confirmable outcome kind, or return null if not verifiable. */
function classifyJourneyType(journeyType: string): ConfirmableOutcomeKind | null {
  const type = journeyType.toLowerCase()
  if (type === 'checkout' || type === 'purchase' || type === 'buy_flow') return 'CHECKOUT'
  if (type === 'login' || type === 'signin' || type === 'sign_in') return 'LOGIN'
  if (type === 'signup' || type === 'register' || type === 'sign_up' || type === 'registration') return 'SIGNUP'
  if (type === 'password_reset' || type === 'forgot_password' || type === 'reset_password' || type === 'recover_account') return 'PASSWORD_RESET'
  return null
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
  await prisma.$transaction(async (tx) => {
    const owner = input.site.projectId
      ? { projectId: input.site.projectId }
      : { provisionalSiteId: input.site.provisionalSiteId! }
    const observed = new Map(audit.pages.map((page) => [page.url, page.title]))
    for (const journey of audit.journeyReviews) {
      observed.set(journey.startUrl, observed.get(journey.startUrl) ?? null)
      for (const step of journey.steps) observed.set(step.url, observed.get(step.url) ?? null)
    }
    const pages = new Map<string, string>()
    for (const [rawUrl, title] of observed) {
      const url = new URL(rawUrl)
      if (!['http:', 'https:'].includes(url.protocol)) continue
      // External steps remain in their original execution; they are not owned Site pages.
      if (url.hostname !== new URL(input.site.url).hostname) continue
      url.hash = ''
      const pageUrl = url.toString()
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
        create: { ...owner, url: pageUrl, path: url.pathname, title },
        update: { title },
      })
      pages.set(rawUrl, page.id)
    }
    // First pass: classify each journey to a confirmable kind
    const classifiedJourneys = new Map<string, ConfirmableOutcomeKind>()
    for (const journey of audit.journeyReviews) {
      const kind = classifyJourneyType(journey.journeyType)
      if (kind) {
        classifiedJourneys.set(journey.journeyType, kind)
      }
    }
    // Second pass: upsert outcomes for classified journeys only (no GENERIC ghosts)
    for (const [journeyType, kind] of classifiedJourneys) {
      // A journey named checkout is not a purchase. Checkout is created below, only from a buyable start.
      if (kind === 'CHECKOUT') continue
      const journey = audit.journeyReviews.find((j) => j.journeyType === journeyType)
      if (!journey) continue
      const name = journeyType.trim().replaceAll('_', ' ')
      if (!name) continue
      const slug = slugify(journeyType)
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
        [journey.startUrl, ...journey.steps.map((step) => step.url)]
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
          },
          update: {
            kind: 'CHECKOUT',
            criticality: 'CRITICAL',
            expectation: 'The selected product appears in the cart and checkout opens.',
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
          update: { config: bindingConfig, enabled: true },
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
  const row = await prisma.siteOutcome.upsert({
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
  })
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

  const updated = await prisma.$transaction(async (tx) => {
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
        bindings: { where: { enabled: true }, select: { key: true, required: true, scope: true, mechanism: true, version: true } },
        assessments: { orderBy: { assessedAt: 'desc' }, take: 1 },
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
  const row = await prisma.siteOutcome.upsert({
    where: { projectId_slug: { projectId: input.site.projectId, slug } },
    create: { projectId: input.site.projectId, slug, name: nameForConfirmedOutcomeKind(input.kind), kind: input.kind,
      expectation: expectationForKind(input.kind), inferenceSource: 'user' },
    update: {},
  })
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

  const updated = await prisma.siteOutcome.update({
    where: { id: outcome.id },
    data: { name: input.name.trim(), inferenceSource: 'user' },
    include: {
      pages: true,
      bindings: { where: { enabled: true }, select: { key: true, required: true, scope: true, mechanism: true, version: true } },
      assessments: { orderBy: { assessedAt: 'desc' }, take: 1 },
      runSelections: { include: { runRequest: true }, orderBy: { runRequest: { requestedAt: 'desc' } }, take: 1 },
    },
  })
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
      bindings: { where: { enabled: true }, select: { key: true, required: true, scope: true, mechanism: true, version: true } },
      assessments: { orderBy: { assessedAt: 'desc' }, take: 1 },
      runSelections: { include: { runRequest: true }, orderBy: { runRequest: { requestedAt: 'desc' } }, take: 1 },
    },
    orderBy: { createdAt: 'asc' },
  })

  return Promise.all(rows.map((row) => toOutcomeView(row)))
}

export type SiteOutcomeDetailView = Omit<SiteOutcomeView, 'bindings'> & {
  bindings: Array<SiteOutcomeView['bindings'][number] & {
    latestEvidence: {
      disposition: string
      reason: string
      detail: Prisma.JsonValue | null
      createdAt: string
      auditId: string
    } | null
    /** Evidence-card sentence for this method. A method with no execution uses the empty-evidence sentence. */
    customerSentence: string
  }>
  limitation: string | null
  recoveryAction: string | null
  lastSuccessfulVerificationAt: string | null
  timeline: Array<{
    id: string
    type: 'run' | 'assessment' | 'attempt' | 'flag' | 'fix' | 'verify'
    at: string
    title: string
    detail: string
    auditId: string | null
  }>
}

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
      bindings: { where: { enabled: true }, select: { key: true, required: true, scope: true, mechanism: true, version: true } },
      assessments: { orderBy: { assessedAt: 'desc' }, take: 20 },
      runSelections: { include: { runRequest: true }, orderBy: { runRequest: { requestedAt: 'desc' } }, take: 20 },
      bindingAttempts: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
  })
  if (!row) return null
  const view = await toOutcomeView(row)
  const [executions, lastSuccessful, improvements] = await Promise.all([
    prisma.outcomeBindingExecution.findMany({
      where: { outcomeId: row.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
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
  // The query is newest first. Keep the first row per key. A later write would keep an older attempt.
  const latestByKey = new Map<string, (typeof executions)[number]>()
  for (const execution of executions) {
    if (!latestByKey.has(execution.bindingKey)) latestByKey.set(execution.bindingKey, execution)
  }
  const timeline = [
    ...row.runSelections.map(({ runRequest }) => ({
      id: `run:${runRequest.id}`,
      type: 'run' as const,
      at: runRequest.requestedAt.toISOString(),
      title: runRequest.status === 'COMPLETED' ? 'Verification completed' : runRequest.status === 'FAILED' ? 'Verification failed' : 'Verification started',
      detail: runRequest.errorMessage ?? `Run ${runRequest.status.toLowerCase()}`,
      auditId: runRequest.auditId,
    })),
    ...row.assessments.map((assessment) => ({
      id: `assessment:${assessment.id}`,
      type: 'assessment' as const,
      at: assessment.assessedAt.toISOString(),
      title: outcomeStatusLabel(currentOutcomeState(assessment)),
      detail: assessment.summary,
      auditId: assessment.auditId,
    })),
    ...row.bindingAttempts.map((attempt) => {
      const sentence = customerBindingResult({
        key: attempt.bindingKey,
        disposition: attempt.disposition,
        reason: attempt.reason,
      })
      return {
        id: `attempt:${attempt.id}`,
        type: 'attempt' as const,
        at: attempt.createdAt.toISOString(),
        title: sentence.headline,
        detail: sentence.detail ?? '',
        auditId: attempt.auditId,
      }
    }),
    ...improvements.flatMap((improvement) => improvement.occurrences.map((occurrence) => ({
      id: `flag:${occurrence.id}`,
      type: 'flag' as const,
      at: occurrence.createdAt.toISOString(),
      title: occurrence.kind === 'REGRESSED'
        ? 'Flag recurred'
        : occurrence.kind === 'CLEARED'
          ? 'Flag recovered'
          : 'Flag recorded',
      detail: improvement.title,
      auditId: occurrence.auditId,
    }))),
    ...improvements.flatMap((improvement) => improvement.attempts.map((attempt) => ({
      id: `fix:${attempt.id}`,
      type: attempt.outcome ? 'verify' as const : 'fix' as const,
      at: attempt.createdAt.toISOString(),
      title: attempt.outcome
        ? attempt.outcome === 'IMPROVED' ? 'Recovery verified' : `Verification ${attempt.outcome.toLowerCase()}`
        : 'Fix recorded',
      detail: attempt.changeSummary ?? attempt.verificationReason ?? improvement.title,
      auditId: attempt.verificationAuditId ?? attempt.sourceAuditId,
    }))),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))

  const requiredBindings = view.bindings.filter((binding) => binding.required)
  const checkoutBinding = requiredBindings.find((binding) => binding.key.includes('checkout'))
  const availabilityBinding = requiredBindings.find((binding) => binding.mechanism === 'HTTP_AVAILABILITY')
  const limitation = !view.enabled
    ? 'This Outcome is paused. Its last evidence is preserved, but FixFlags will not schedule or start another verification.'
    : requiredBindings.length === 0
      ? 'No independent verification method is configured.'
      : view.state === 'COULD_NOT_VERIFY'
        ? view.summary
        : null
  const recoveryAction = !view.enabled
    ? 'Enable this Outcome to verify it again.'
    : requiredBindings.length === 0
      ? 'Configure a supported verification method in Site settings.'
      : view.state === 'STALE'
        ? staleOutcomeRecovery()
        : view.state === 'COULD_NOT_VERIFY'
          ? view.kind === 'CHECKOUT'
            ? checkoutCouldNotVerifyRecovery(checkoutBinding ? latestByKey.get(checkoutBinding.key)?.reason : null)
            : view.kind === 'AVAILABILITY'
              ? availabilityCouldNotVerifyRecovery(availabilityBinding ? latestByKey.get(availabilityBinding.key)?.reason : null)
              : 'Review the method or fixture, then verify again.'
          : null

  return {
    ...view,
    bindings: view.bindings.map((binding) => {
      const evidence = latestByKey.get(binding.key)
      const sentence = evidence
        ? customerBindingResult({
            key: binding.key,
            disposition: evidence.disposition,
            reason: evidence.reason,
          })
        : null
      return {
        ...binding,
        latestEvidence: evidence ? {
          disposition: evidence.disposition,
          reason: evidence.reason,
          detail: evidence.detail,
          createdAt: evidence.createdAt.toISOString(),
          auditId: evidence.auditId,
        } : null,
        customerSentence: sentence?.headline ?? OUTCOME_DETAIL_COPY.noEvidence,
      }
    }),
    limitation,
    recoveryAction,
    lastSuccessfulVerificationAt: lastSuccessful?.assessedAt.toISOString() ?? null,
    timeline,
  }
}

export async function setSiteOutcomeEnabled(input: {
  site: SiteRecord
  outcomeId: string
  enabled: boolean
}): Promise<SiteOutcomeDetailView | null> {
  if (!input.site.projectId) return null
  const changed = await prisma.siteOutcome.updateMany({
    where: { id: input.outcomeId, projectId: input.site.projectId },
    data: { enabled: input.enabled },
  })
  if (changed.count !== 1) return null
  return loadSiteOutcomeDetail(input.site, input.outcomeId)
}
