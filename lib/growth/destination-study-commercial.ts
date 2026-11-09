import { z } from 'zod'
import { GUIDE_WITH_STUDY } from '@/lib/marketing/copy/destination-study'
import { COMMERCIAL_EVIDENCE_SOURCE } from './commercial-evidence'

const count = z.number().int().nonnegative()
const positiveCount = count.min(1).nullable()
const receiptSchema = z.object({
  version: z.literal(1),
  source: z.literal(COMMERCIAL_EVIDENCE_SOURCE),
  databaseWritten: z.literal(false),
  providerWritten: z.literal(false),
  ledgerWindow: z.object({ since: z.iso.datetime(), asOf: z.iso.datetime() }),
  guideCohort: z.object({
    guide: z.literal(GUIDE_WITH_STUDY),
    firstStartDay: z.iso.date(),
    cohortEndExclusive: z.iso.datetime(),
    fullyMatureAt: z.iso.datetime(),
    fullyMature: z.boolean(),
    billingEvidenceThrough: z.iso.datetime(),
  }),
  claimCohort: z.object({
    status: z.enum(['available', 'guide-followup-incomplete', 'claim-owner-limit-exceeded']),
    followupDays: z.literal(28),
    counts: z.object({
      matureExactClaimOwners: count,
      ownersWithCurrentBillingCustomer: count,
      ownersWithRetainedPositiveCurrentCustomerInvoice: count,
    }).nullable(),
  }),
  verification: z.object({
    status: z.enum(['attempted', 'no-eligible-ledger-rows', 'not-requested', 'test-credential', 'live-credential-unavailable',
      'guide-followup-incomplete', 'claim-owner-limit-exceeded', 'candidate-limit-exceeded']),
    confirmedCaptures: positiveCount,
    failedReads: count,
    incompatibleCaptures: count,
    duplicateCaptureEntries: count,
  }),
  postClaimInvoices: z.object({
    followupDays: z.literal(28),
    invoiceCandidates: count,
    invoiceReadFailures: count,
    incompatibleInvoices: count,
    verifiedPaidInvoices: positiveCount,
    ownersWithVerifiedPaidInvoice: positiveCount,
  }),
})

/** Project one read-only commercial receipt without merging its owners into Site counts. */
export function readDestinationStudyCommercial(input: unknown, start: Date, end: Date) {
  if (input === undefined) return null
  const { guideCohort, ledgerWindow, claimCohort, verification, postClaimInvoices } = receiptSchema.parse(input)
  const matureAt = end.getTime() + 35 * 86_400_000
  const asOf = Date.parse(ledgerWindow.asOf)
  const fullyMature = asOf >= matureAt
  if (guideCohort.firstStartDay !== start.toISOString().slice(0, 10) ||
    Date.parse(ledgerWindow.since) !== start.getTime() || Date.parse(guideCohort.cohortEndExclusive) !== end.getTime() ||
    Date.parse(guideCohort.fullyMatureAt) !== matureAt || asOf < end.getTime() || guideCohort.fullyMature !== fullyMature ||
    Date.parse(guideCohort.billingEvidenceThrough) !== Math.min(matureAt, asOf)) throw new Error('Mismatched commercial evidence window')

  const { counts, status } = claimCohort
  const { invoiceCandidates, invoiceReadFailures, incompatibleInvoices, verifiedPaidInvoices, ownersWithVerifiedPaidInvoice } = postClaimInvoices
  const invoices = verifiedPaidInvoices ?? 0
  const owners = ownersWithVerifiedPaidInvoice ?? 0
  if ((status === 'available') !== (counts !== null) || (status === 'guide-followup-incomplete') === fullyMature ||
    (status !== 'available' && verification.status !== status) ||
    (counts && (counts.ownersWithRetainedPositiveCurrentCustomerInvoice > counts.ownersWithCurrentBillingCustomer ||
      counts.ownersWithCurrentBillingCustomer > counts.matureExactClaimOwners)) ||
    (verification.status !== 'attempted' && (verification.confirmedCaptures !== null || invoiceCandidates > 0)) ||
    invoiceCandidates > (verification.confirmedCaptures ?? 0) ||
    invoiceReadFailures + incompatibleInvoices + invoices !== invoiceCandidates ||
    (invoices === 0) !== (owners === 0) || owners > invoices ||
    owners > (counts?.ownersWithRetainedPositiveCurrentCustomerInvoice ?? 0)) throw new Error('Inconsistent commercial evidence counts')

  return {
    asOf: ledgerWindow.asOf,
    billingEvidenceThrough: guideCohort.billingEvidenceThrough,
    fullyMature,
    claimCohortStatus: status,
    captureVerification: verification,
    counts,
    postClaimInvoices,
  }
}
