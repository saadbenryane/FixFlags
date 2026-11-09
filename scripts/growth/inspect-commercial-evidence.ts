import { PrismaClient } from '@prisma/client'
import { parseArgs } from 'node:util'
import { z } from 'zod'
import { isGuideEntry } from '@/lib/analytics/guide-entry'
import { inspectCommercialEvidence, PAID_INVOICE_HISTORY_LIMIT, stripeReportingMode, type CommercialVerification } from '@/lib/growth/commercial-evidence'

async function main() {
  const { positionals, values, tokens } = parseArgs({ allowPositionals: true, tokens: true, options: {
    'verify-live': { type: 'boolean' }, 'after-claim': { type: 'boolean' }, 'first-paid-invoice': { type: 'boolean' },
    guide: { type: 'string' }, 'starts-from': { type: 'string' }, 'starts-before': { type: 'string' },
  } })
  const optionNames = tokens.flatMap(token => token.kind === 'option' ? [token.name] : [])
  if (new Set(optionNames).size !== optionNames.length) throw new Error('Duplicate inspection option')
  const [daysArgument = '30'] = positionals
  const days = Number(daysArgument)
  const verifyLive = values['verify-live'] ?? false
  const includePostClaimInvoices = values['after-claim'] ?? false
  const includeFirstPaidInvoice = values['first-paid-invoice'] ?? false
  const guide = values.guide
  let guideWindow
  if (guide !== undefined || values['starts-from'] !== undefined || values['starts-before'] !== undefined) {
    if (!isGuideEntry(guide) || positionals.length || !includePostClaimInvoices) throw new Error('Invalid guide options')
    guideWindow = { guide, start: new Date(z.iso.date().parse(values['starts-from'])),
      endExclusive: new Date(z.iso.date().parse(values['starts-before'])) }
  }
  if (positionals.length > 1 || !Number.isInteger(days) || days < 1 || days > 90 ||
    (includeFirstPaidInvoice && (!includePostClaimInvoices || !verifyLive))) throw new Error('Invalid inspection options')
  const url = new URL(process.env.DATABASE_URL ?? '')
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('Loopback database required')
  }
  const mode = stripeReportingMode(process.env.STRIPE_SECRET_KEY)
  let verification: CommercialVerification = { status: 'not-requested' }
  if (verifyLive && mode === 'live') {
    const { getStripe } = await import('@/lib/stripe')
    const stripe = getStripe()
    verification = { status: 'live-requested', retrieve: id => stripe.paymentIntents.retrieve(id, { expand: ['latest_charge'] }),
      ...(includePostClaimInvoices && { retrieveInvoice: (id: string) => stripe.invoices.retrieve(id) }),
      ...(includeFirstPaidInvoice && { listPaidInvoices: (customer: string) =>
        stripe.invoices.list({ customer, status: 'paid', limit: PAID_INVOICE_HISTORY_LIMIT }) }),
    }
  } else if (verifyLive) {
    verification = { status: mode === 'test' ? 'test-credential' : 'live-credential-unavailable' }
  }
  const db = new PrismaClient({ datasourceUrl: url.toString(), log: [] })
  try {
    const now = new Date()
    const report = await inspectCommercialEvidence({
      since: guideWindow?.start ?? new Date(now.getTime() - days * 86_400_000), now, verification,
      includePostClaimInvoices, includeFirstPaidInvoice, guideWindow,
    }, db)
    console.log(JSON.stringify(report, null, 2))
    if (report.claimCohort?.status === 'claim-owner-limit-exceeded') process.exitCode = 1
    if (verifyLive && (verification.status !== 'live-requested' || report.verification.status === 'candidate-limit-exceeded' ||
      report.verification.failedReads > 0 || (report.postClaimInvoices?.invoiceReadFailures ?? 0) > 0 ||
      report.firstPaidInvoiceAfterClaim?.status === 'partial' || report.firstPaidInvoiceAfterClaim?.status === 'unavailable')) process.exitCode = 1
  } finally {
    await db.$disconnect()
  }
}

main().catch(() => {
  console.error('Commercial evidence inspection unavailable. Use loopback PostgreSQL and a window of 1 to 90 days. Use --after-claim for the retained claim cohort. The --first-paid-invoice option requires --after-claim and --verify-live. For a guide, use --guide <label> --starts-from <day> --starts-before <day> with 28 closed UTC days.')
  process.exitCode = 1
})
