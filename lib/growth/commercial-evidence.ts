import type { Prisma, PrismaClient } from '@prisma/client'
import type Stripe from 'stripe'
import { ACQUISITION_FOLLOWUP_DAYS, consentedGuideClaimEntry, fixedStartWindow } from '@/lib/analytics/acquisition-value-cohort'
import { isGuideEntry, type GuideEntry } from '@/lib/analytics/guide-entry'

const PAYMENT_KINDS = ['INVOICE_PAYMENT', 'CREDIT_PAYMENT']
const LEDGER_LIMIT = 5_000
const CLAIM_OWNER_LIMIT = 5_000
const LIVE_READ_LIMIT = 50
export const PAID_INVOICE_HISTORY_LIMIT = 100
export const COMMERCIAL_EVIDENCE_SOURCE = 'retained-billing-ledger-and-optional-live-stripe-capture-read'
const PAYMENT_ID = /^pi_[A-Za-z0-9]+$/
const CHARGE_ID = /^ch_[A-Za-z0-9]+$/
const INVOICE_ID = /^in_[A-Za-z0-9]+$/
const CUSTOMER_ID = /^cus_[A-Za-z0-9]+$/
const CLAIM_FOLLOWUP_DAYS = 28
const DAY = 86_400_000
const CLAIM_FOLLOWUP_MS = CLAIM_FOLLOWUP_DAYS * DAY
type GuideWindow = { guide: GuideEntry; start: Date; endExclusive: Date }
type BillingClaim = { claimedAt: Date; stripeCustomerId: string | null }

type LedgerRow = {
  kind: string
  providerId: string
  paymentReference: string | null
  customerId: string | null
  userId: string | null
  user: { stripeCustomerId: string | null } | null
  amountMinor: number
  currency: string
  status: string
  occurredAt: Date
}

export type CommercialVerification =
  | { status: 'not-requested' | 'test-credential' | 'live-credential-unavailable' }
  | { status: 'live-requested'; retrieve: (paymentId: string) => Promise<Stripe.PaymentIntent>;
      retrieveInvoice?: (invoiceId: string) => Promise<Stripe.Invoice>;
      listPaidInvoices?: (customerId: string) => Promise<Stripe.ApiList<Stripe.Invoice>> }

export function stripeReportingMode(key: string | undefined) {
  if (/^(sk|rk)_live_/.test(key ?? '')) return 'live'
  if (/^(sk|rk)_test_/.test(key ?? '')) return 'test'
  return 'unavailable'
}

function reference(value: string | { id: string } | null | undefined) {
  return typeof value === 'string' ? value : value?.id ?? null
}

function exactLiveCapture(row: LedgerRow, intent: Stripe.PaymentIntent) {
  const charge = intent.latest_charge
  if (!charge || typeof charge === 'string' || charge.object !== 'charge' || !CHARGE_ID.test(charge.id)) return null
  if (intent.object !== 'payment_intent' || intent.id !== row.paymentReference || intent.livemode !== true || intent.status !== 'succeeded' ||
    charge.livemode !== true || charge.status !== 'succeeded' || charge.captured !== true || charge.paid !== true ||
    reference(charge.payment_intent) !== intent.id || charge.amount_captured !== row.amountMinor ||
    intent.amount_received !== row.amountMinor || charge.currency !== row.currency || intent.currency !== row.currency ||
    reference(intent.customer) !== row.customerId || reference(charge.customer) !== row.customerId) return null
  if (row.kind === 'INVOICE_PAYMENT' &&
    (reference(intent.invoice) !== row.providerId || reference(charge.invoice) !== row.providerId)) return null
  if (row.kind === 'CREDIT_PAYMENT' && (reference(intent.invoice) || reference(charge.invoice))) return null
  return charge.id
}

async function firstRetainedClaims(tx: Prisma.TransactionClient, owners: string[], since: Date, now: Date, guideWindow?: GuideWindow) {
  if (!owners.length) return new Map<string, BillingClaim>()
  const latest = new Date(now.getTime() - CLAIM_FOLLOWUP_MS)
  const rows = await tx.$queryRaw<Array<BillingClaim & { userId: string; id: string; createdAt: Date; parentId: string | null; source: string }>>`
    WITH first_claim AS (
      SELECT DISTINCT ON (event."userId") event.id, event."userId", event."projectId", event."idempotencyKey", event."createdAt"
      FROM site_lifecycle_events event
      WHERE event."userId" = ANY(${owners}::text[]) AND event.name = 'analysis_claimed' AND event.version = 1
        AND event."createdAt" <= ${now}
      ORDER BY event."userId", event."createdAt", event.id
    )
    SELECT claim."userId", claim."createdAt" AS "claimedAt", account."stripeCustomerId",
      audit.id, audit."createdAt", audit."parentId", audit.source
    FROM first_claim claim
    JOIN users account ON account.id = claim."userId" AND account."lifecycleStatus" = 'ACTIVE'
    JOIN projects site ON site.id = claim."projectId" AND site."userId" = claim."userId" AND site."deletedAt" IS NULL
    JOIN audits audit ON claim."idempotencyKey" = ('analysis_claimed:' || audit.id)
      AND audit."projectId" = site.id AND audit."userId" = claim."userId"
    WHERE claim."createdAt" BETWEEN ${since} AND ${latest}
      AND site."createdAt" <= claim."createdAt" AND audit."createdAt" <= claim."createdAt"
      AND audit."parentId" IS NULL AND audit.source <> 'SEED'
      AND (NOT ${Boolean(guideWindow)} OR NOT EXISTS (
        SELECT 1 FROM site_lifecycle_events earlier
        WHERE earlier."projectId" = claim."projectId" AND earlier."userId" IS NOT NULL
          AND earlier.name = 'analysis_claimed' AND earlier.version = 1 AND starts_with(earlier."idempotencyKey", 'analysis_claimed:')
          AND (earlier."createdAt", earlier.id) < (claim."createdAt", claim.id)
      ))
  `
  const claims = new Map(rows.map(({ userId, claimedAt, stripeCustomerId }) => [userId, { claimedAt, stripeCustomerId }]))
  if (!guideWindow || !rows.length) return claims
  const starts = await tx.siteLifecycleEvent.findMany({
    where: { name: 'analyze_started', version: 1, userId: null, idempotencyKey: { in: rows.map(row => 'analyze_started:' + row.id) },
      createdAt: { gte: guideWindow.start, lt: guideWindow.endExclusive } },
    select: { idempotencyKey: true, version: true, userId: true, createdAt: true, properties: true },
  })
  const byKey = new Map(starts.map(start => [start.idempotencyKey, start]))
  for (const row of rows) {
    const start = byKey.get('analyze_started:' + row.id)
    if (!start || consentedGuideClaimEntry(start, row, row.claimedAt) !== guideWindow.guide) claims.delete(row.userId)
  }
  return claims
}

async function readClaimCohort(tx: Prisma.TransactionClient, since: Date, end: Date, guideWindow?: GuideWindow) {
  const latest = new Date(end.getTime() - CLAIM_FOLLOWUP_MS)
  const owners = latest < since ? [] : await tx.$queryRaw<Array<{ userId: string }>>`
    SELECT DISTINCT "userId" FROM site_lifecycle_events
    WHERE "userId" IS NOT NULL AND name = 'analysis_claimed' AND version = 1
      AND "createdAt" BETWEEN ${since} AND ${latest}
    LIMIT ${CLAIM_OWNER_LIMIT + 1}
  `
  if (owners.length > CLAIM_OWNER_LIMIT) return { status: 'claim-owner-limit-exceeded' as const, claims: new Map<string, BillingClaim>() }
  return { status: 'available' as const,
    claims: await firstRetainedClaims(tx, owners.map(row => row.userId), since, end, guideWindow) }
}

function invoiceOwner(row: LedgerRow) {
  return row.kind === 'INVOICE_PAYMENT' && INVOICE_ID.test(row.providerId) && row.customerId && CUSTOMER_ID.test(row.customerId) &&
    row.user?.stripeCustomerId === row.customerId ? row.userId : null
}

function eligibleInvoiceOwner(row: LedgerRow, claims: ReadonlyMap<string, BillingClaim>) {
  const owner = invoiceOwner(row)
  const claim = owner ? claims.get(owner) : undefined
  const delay = claim ? row.occurredAt.getTime() - claim.claimedAt.getTime() : 0
  return owner && delay > 0 && delay <= CLAIM_FOLLOWUP_MS ? owner : null
}

function invoicePaidTimestamp(invoice: Stripe.Invoice) {
  const seconds = invoice.status_transitions?.paid_at
  return typeof seconds === 'number' && seconds > 0 && Number.isSafeInteger(seconds) && Number.isSafeInteger(seconds * 1000)
    ? seconds * 1000 : null
}

function verifiedInvoicePaidAt(row: LedgerRow, invoice: Stripe.Invoice) {
  const paidAt = invoicePaidTimestamp(invoice)
  if (invoice.object !== 'invoice' || invoice.id !== row.providerId || invoice.livemode !== true ||
    invoice.status !== 'paid' || invoice.paid !== true || invoice.paid_out_of_band !== false ||
    reference(invoice.customer) !== row.customerId || reference(invoice.payment_intent) !== row.paymentReference ||
    invoice.amount_paid !== row.amountMinor || invoice.currency !== row.currency || paidAt === null) return null
  return paidAt === row.occurredAt.getTime() ? paidAt : null
}

function classifyPaidInvoiceHistory(page: Stripe.ApiList<Stripe.Invoice>, customer: string, candidates: LedgerRow[], asOf: Date) {
  if (page.object !== 'list' || !Array.isArray(page.data)) return 'incompatibleHistory'
  if (page.has_more === true || page.data.length > PAID_INVOICE_HISTORY_LIMIT) return 'incompleteHistory'
  if (page.has_more !== false) return 'incompatibleHistory'
  const seen = new Map<string, Stripe.Invoice>()
  let firstAt = Infinity
  let firstId: string | undefined
  let tied = false
  for (const invoice of page.data) {
    if (!invoice || invoice.object !== 'invoice' || !INVOICE_ID.test(invoice.id) || invoice.livemode !== true ||
      invoice.status !== 'paid' || invoice.paid !== true || reference(invoice.customer) !== customer ||
      !Number.isSafeInteger(invoice.amount_paid) || invoice.amount_paid < 0 || seen.has(invoice.id)) return 'incompatibleHistory'
    seen.set(invoice.id, invoice)
    if (invoice.amount_paid === 0) continue
    const paidAt = invoicePaidTimestamp(invoice)
    if (paidAt === null) return 'incompatibleHistory'
    if (paidAt > asOf.getTime()) continue
    if (paidAt < firstAt) {
      firstAt = paidAt
      firstId = invoice.id
      tied = false
    } else if (paidAt === firstAt) tied = true
  }
  for (const candidate of candidates) {
    const invoice = seen.get(candidate.providerId)
    if (!invoice || verifiedInvoicePaidAt(candidate, invoice) === null) return 'incompatibleHistory'
  }
  if (tied) return 'ambiguousFirstPaidTime'
  return candidates.some(candidate => candidate.providerId === firstId) ? 'verifiedFirstPaidInvoice' : 'earlierPaidInvoice'
}

async function readFirstPaidInvoiceMilestone(verified: LedgerRow[], list: ((customerId: string) => Promise<Stripe.ApiList<Stripe.Invoice>>) | undefined,
  asOf: Date) {
  const byCustomer = [...Map.groupBy(verified, row => row.customerId!)]
  const counts = { verifiedFirstPaidInvoice: 0, earlierPaidInvoice: 0, historyReadFailed: 0,
    incompleteHistory: 0, incompatibleHistory: 0, ambiguousFirstPaidTime: 0 }
  if (list) for (let index = 0; index < byCustomer.length; index += 5) {
    const results = await Promise.allSettled(byCustomer.slice(index, index + 5).map(async ([customer, rows]) =>
      classifyPaidInvoiceHistory(await list(customer), customer, rows, asOf)))
    for (const result of results) counts[result.status === 'fulfilled' ? result.value : 'historyReadFailed']++
  }
  const resolved = counts.verifiedFirstPaidInvoice + counts.earlierPaidInvoice
  const status = !list ? 'unavailable' : !byCustomer.length ? 'no-verified-post-claim-invoices' :
    resolved === byCustomer.length ? 'available' : 'partial'
  return {
    status, customersWithVerifiedPostClaimInvoice: byCustomer.length, historyPageLimit: PAID_INVOICE_HISTORY_LIMIT,
    customersWithVerifiedFirstPaidInvoice: counts.verifiedFirstPaidInvoice || (status === 'available' ? 0 : null),
    earlierPaidInvoiceCustomers: counts.earlierPaidInvoice,
    historyReadFailures: counts.historyReadFailed, incompleteHistories: counts.incompleteHistory,
    incompatibleHistories: counts.incompatibleHistory, ambiguousFirstPaidTimes: counts.ambiguousFirstPaidTime,
    limitation: 'Earliest positive paid invoice in the current live Stripe customer history. It does not establish the first payment across other customers, credit purchases, an eligible conversion denominator, or revenue.',
  }
}

/** Compare retained ledger candidates to exact live captures, without changing billing state. */
export async function inspectCommercialEvidence(input: {
  since: Date; now: Date; verification: CommercialVerification; includePostClaimInvoices?: boolean;
  includeFirstPaidInvoice?: boolean; guideWindow?: GuideWindow
}, db: Pick<PrismaClient, '$transaction'>) {
  if (!Number.isFinite(input.since.getTime()) || !Number.isFinite(input.now.getTime()) || input.since > input.now) {
    throw new Error('Invalid commercial evidence window')
  }
  if (input.includeFirstPaidInvoice && !input.includePostClaimInvoices) throw new Error('First paid invoice requires post-claim verification')
  const verification = input.verification
  const guideWindow = input.guideWindow
  if (guideWindow && (!input.includePostClaimInvoices || !isGuideEntry(guideWindow.guide) ||
    guideWindow.start.getTime() !== input.since.getTime() || guideWindow.start.getTime() % DAY !== 0 ||
    guideWindow.endExclusive.getTime() - guideWindow.start.getTime() !== 28 * DAY)) throw new Error('Invalid guide payment window')
  const guideMaturity = guideWindow && fixedStartWindow(guideWindow.start, guideWindow.endExclusive, input.now,
    ACQUISITION_FOLLOWUP_DAYS + CLAIM_FOLLOWUP_DAYS)
  const occurrenceEnd = guideMaturity?.fullyMature ? new Date(guideMaturity.fullyMatureAt) : input.now
  const { retained, paymentRows, positive, candidates, cohort } = await db.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`
    const retained = await tx.billingLedgerEntry.findMany({
      where: { occurredAt: { gte: input.since, lte: occurrenceEnd }, recordedAt: { lte: input.now } },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }], take: LEDGER_LIMIT + 1,
      select: { kind: true, providerId: true, paymentReference: true, customerId: true,
        userId: true, user: { select: { stripeCustomerId: true } }, amountMinor: true, currency: true, status: true, occurredAt: true },
    })
    if (retained.length > LEDGER_LIMIT) throw new Error('Commercial evidence exceeds the ledger limit')
    const refs = [...new Set(retained.flatMap(row => PAYMENT_KINDS.includes(row.kind) &&
      row.status === 'SUCCEEDED' && row.amountMinor > 0 && row.paymentReference ? [row.paymentReference] : []))]
    const groups = refs.length ? await tx.billingLedgerEntry.groupBy({
      by: ['paymentReference'],
      where: { kind: { in: PAYMENT_KINDS }, status: 'SUCCEEDED', recordedAt: { lte: input.now },
        paymentReference: { in: refs } },
      _count: { _all: true },
    }) : []
    const repeated = new Set(groups.filter(group => group._count._all > 1).map(group => group.paymentReference))
    const paymentRows = retained.filter(row => PAYMENT_KINDS.includes(row.kind) && row.status === 'SUCCEEDED')
    const positive = paymentRows.filter(row => row.amountMinor > 0)
    const ledgerCandidates = positive.filter(row => row.paymentReference && PAYMENT_ID.test(row.paymentReference) &&
      !repeated.has(row.paymentReference) && /^[a-z]{3}$/.test(row.currency))
    const cohort = input.includePostClaimInvoices && guideMaturity?.fullyMature !== false
      ? await readClaimCohort(tx, input.since, occurrenceEnd, guideWindow) : null
    const candidates = guideWindow ? ledgerCandidates.filter(row => cohort && eligibleInvoiceOwner(row, cohort.claims)) : ledgerCandidates
    return { retained, paymentRows, positive, candidates, cohort }
  }, { isolationLevel: 'RepeatableRead' })

  const claims = cohort?.claims ?? new Map<string, BillingClaim>()
  const verificationStatus = guideMaturity && !guideMaturity.fullyMature ? 'guide-followup-incomplete' :
    guideWindow && cohort?.status === 'claim-owner-limit-exceeded' ? 'claim-owner-limit-exceeded' : verification.status === 'live-requested'
    ? candidates.length > LIVE_READ_LIMIT ? 'candidate-limit-exceeded' : candidates.length ? 'attempted' : 'no-eligible-ledger-rows'
    : verification.status
  let failedReads = 0
  let mismatched = 0
  const matches = new Map<string, LedgerRow[]>()
  if (verification.status === 'live-requested' && verificationStatus === 'attempted') {
    for (let index = 0; index < candidates.length; index += 5) {
      const batch = candidates.slice(index, index + 5)
      const results = await Promise.allSettled(batch.map(async row => {
        const intent = await verification.retrieve(row.paymentReference!)
        return exactLiveCapture(row, intent)
      }))
      for (const [offset, result] of results.entries()) {
        if (result.status === 'rejected') failedReads++
        else if (!result.value) mismatched++
        else {
          const group = matches.get(result.value) ?? []
          group.push(batch[offset])
          matches.set(result.value, group)
        }
      }
    }
  }
  const confirmed = [...matches.values()].filter(rows => rows.length === 1).map(rows => rows[0])
  const currencies = Map.groupBy(confirmed, row => row.currency)
  let invoiceCandidates = 0
  let invoiceReadFailures = 0
  let incompatibleInvoices = 0
  const verifiedInvoices: LedgerRow[] = []
  const verifiedOwners = new Set<string>()
  if (input.includePostClaimInvoices && verification.status === 'live-requested' && verification.retrieveInvoice) {
    const retrieveInvoice = verification.retrieveInvoice
    const invoices = confirmed.flatMap(row => {
      const owner = eligibleInvoiceOwner(row, claims)
      return owner ? [{ row, owner }] : []
    })
    invoiceCandidates = invoices.length
    for (let index = 0; index < invoices.length; index += 5) {
      const batch = invoices.slice(index, index + 5)
      const results = await Promise.allSettled(batch.map(async ({ row }) =>
        verifiedInvoicePaidAt(row, await retrieveInvoice(row.providerId))))
      for (const [offset, result] of results.entries()) {
        if (result.status === 'rejected') invoiceReadFailures++
        else if (result.value === null) incompatibleInvoices++
        else {
          verifiedInvoices.push(batch[offset].row)
          verifiedOwners.add(batch[offset].owner)
        }
      }
    }
  }
  const firstPaidInvoiceAfterClaim = input.includeFirstPaidInvoice && await readFirstPaidInvoiceMilestone(verifiedInvoices,
    verification.status === 'live-requested' ? verification.listPaidInvoices : undefined, input.now)
  const ownersWithRetainedInvoice = new Set(positive.flatMap(row => eligibleInvoiceOwner(row, claims) ?? []))
  return {
    version: 1,
    source: COMMERCIAL_EVIDENCE_SOURCE,
    ledgerWindow: { since: input.since.toISOString(), asOf: input.now.toISOString() },
    databaseWritten: false,
    providerWritten: false,
    ...(guideWindow && guideMaturity && { guideCohort: {
      guide: guideWindow.guide, firstStartDay: guideWindow.start.toISOString().slice(0, 10), ...guideMaturity,
      billingEvidenceThrough: occurrenceEnd.toISOString(),
      limitations: ['Guide scope requires the current owner and Site to share the earliest retained claim, with a consented start for that exact audit within seven days before claim.',
        'The ledger counts cover the window. Provider matches are limited to eligible guide invoices and describe account payment without attributing it to the guide.'],
    } }),
    ...(input.includePostClaimInvoices && { claimCohort: {
      status: cohort?.status ?? 'guide-followup-incomplete',
      followupDays: CLAIM_FOLLOWUP_DAYS,
      counts: cohort?.status === 'available' ? {
        matureExactClaimOwners: claims.size,
        ownersWithCurrentBillingCustomer: [...claims.values()].filter(claim =>
          claim.stripeCustomerId && CUSTOMER_ID.test(claim.stripeCustomerId)).length,
        ownersWithRetainedPositiveCurrentCustomerInvoice: ownersWithRetainedInvoice.size,
        ownersWithoutRetainedPositiveCurrentCustomerInvoice: claims.size - ownersWithRetainedInvoice.size,
      } : null,
      limitations: [
        'This cohort comes from each active owner’s earliest retained claim and complete follow-up. Prior claims outside retained history are unknown.',
        'A missing matching ledger invoice leaves payment unknown. These owner counts are not a paid conversion denominator for all first-ever customers.',
      ],
    } }),
    ...(input.includePostClaimInvoices && { postClaimInvoices: {
      followupDays: CLAIM_FOLLOWUP_DAYS, invoiceCandidates, invoiceReadFailures, incompatibleInvoices,
      verifiedPaidInvoices: verifiedInvoices.length || null, ownersWithVerifiedPaidInvoice: verifiedOwners.size || null,
      limitations: [
        'Payments are linked to the current billing owner and timed after their first retained exact Site claim. Billing belongs to the account.',
        'This milestone uses verified live paid invoices within 28 days of claim. It cannot establish the first-ever payment, paid conversion rate, Site revenue, or payout settlement.',
      ],
    } }),
    ...(firstPaidInvoiceAfterClaim && { firstPaidInvoiceAfterClaim }),
    ledger: {
      retainedEntries: retained.length,
      positiveSucceededPaymentEntries: positive.length,
      zeroAmountSucceededPaymentEntries: paymentRows.filter(row => row.amountMinor === 0).length,
      retainedRefundEntries: retained.filter(row => row.kind === 'REFUND').length,
      eligibleForExactCaptureRead: candidates.length,
    },
    verification: {
      status: verificationStatus,
      failedReads,
      incompatibleCaptures: mismatched,
      duplicateCaptureEntries: [...matches.values()].filter(rows => rows.length > 1).reduce((sum, rows) => sum + rows.length, 0),
      confirmedCaptures: verificationStatus === 'attempted' && confirmed.length ? confirmed.length : null,
      distinctCurrentOwnersWithConfirmedCapture: confirmed.length ? new Set(confirmed.flatMap(row =>
        row.userId && row.customerId && row.user?.stripeCustomerId === row.customerId ? [row.userId] : [])).size : null,
      confirmedGrossMinorByCurrency: confirmed.length ? [...currencies].sort(([a], [b]) => a.localeCompare(b))
        .map(([currency, rows]) => ({ currency, capturedPayments: rows.length,
          grossMinor: rows.reduce((sum, row) => sum + row.amountMinor, 0) })) : null,
    },
    limitations: [
      'The window uses retained ledger occurrence dates. It does not establish the capture timestamp or complete Stripe history.',
      'Verified gross amounts are limited to exact live captures that match retained references, currency, amount and customer. Unavailable evidence leaves totals unknown.',
      'Gross captures are before refunds, fees and disputes. Payouts, off-platform receipts, net revenue and paid-conversion rates are outside this report.',
    ],
  }
}
