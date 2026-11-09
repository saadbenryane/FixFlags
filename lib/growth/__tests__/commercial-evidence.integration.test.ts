import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import type Stripe from 'stripe'
import { describe, expect, it, vi } from 'vitest'
import { inspectCommercialEvidence, stripeReportingMode } from '../commercial-evidence'
import { readDestinationStudyCommercial } from '../destination-study-commercial'

const databaseUrl = process.env.GROWTH_TEST_DATABASE_URL

describe('commercial reporting credential mode', () => {
  it('distinguishes Stripe test, live, and unavailable configuration', () => {
    expect(stripeReportingMode('rk_live_fixture')).toBe('live')
    expect(stripeReportingMode('sk_test_fixture')).toBe('test')
    expect(stripeReportingMode('pk_live_fixture')).toBe('unavailable')
    expect(stripeReportingMode(undefined)).toBe('unavailable')
  })
})

describe.skipIf(!databaseUrl)('commercial evidence on isolated PostgreSQL', () => {
  it('requires exact live captures and withholds duplicates, mismatches, and unavailable provider reads', async () => {
    const url = new URL(databaseUrl!)
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Fixtures require loopback PostgreSQL')
    const admin = new PrismaClient({ datasourceUrl: url.toString(), log: [] })
    const schema = `commercial_test_${randomUUID().replaceAll('-', '')}`
    url.searchParams.set('schema', schema)
    const db = new PrismaClient({ datasourceUrl: url.toString(), log: [] })
    const now = new Date(Math.floor(Date.now() / 1000) * 1000)
    const day = 86_400_000
    const since = new Date(now.getTime() - 7 * day)
    const owner = 'private-owner'
    const customer = 'cus_private'
    const save = async (id: string, ref: string | null, options: {
      kind?: string; currency?: string; amount?: number; age?: number; recordedAt?: Date; userId?: string | null; customerId?: string
    } = {}) => {
      const occurred = new Date(now.getTime() - (options.age ?? 1) * day)
      await db.$executeRaw`INSERT INTO billing_ledger_entries VALUES (
        ${id}, ${`in_${id}`}, ${options.kind ?? 'INVOICE_PAYMENT'}, ${options.userId === undefined ? owner : options.userId},
        ${options.customerId ?? customer}, ${ref}, ${options.amount ?? 1500}, ${options.currency ?? 'usd'}, 'SUCCEEDED', ${occurred}, ${options.recordedAt ?? occurred}
      )`
    }
    const intent = (ref: string, options: { test?: boolean; amount?: number; currency?: string; invoice?: string | null; captured?: boolean; customer?: string } = {}) => {
      const invoice = options.invoice === undefined ? `in_${ref.slice(3)}` : options.invoice
      const amount = options.amount ?? 1500
      const currency = options.currency ?? 'usd'
      const ownerCustomer = options.customer ?? customer
      return {
        id: ref, object: 'payment_intent', status: 'succeeded', livemode: !options.test,
        invoice, customer: ownerCustomer, amount_received: amount, currency,
        latest_charge: {
          id: `ch_${ref.slice(3)}`, object: 'charge', status: 'succeeded', livemode: !options.test, invoice,
          customer: ownerCustomer, currency, amount_captured: amount, payment_intent: ref,
          captured: options.captured ?? true, paid: true, receipt_email: 'private@example.test',
        },
      } as unknown as Stripe.PaymentIntent
    }
    try {
      await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`)
      await db.$executeRaw`CREATE TABLE users (id text PRIMARY KEY, "stripeCustomerId" text, "lifecycleStatus" text DEFAULT 'ACTIVE')`
      await db.$executeRaw`CREATE TABLE billing_ledger_entries (
        id text PRIMARY KEY, "providerId" text, kind text, "userId" text, "customerId" text,
        "paymentReference" text, "amountMinor" integer, currency text, status text,
        "occurredAt" timestamp(3), "recordedAt" timestamp(3)
      )`
      await db.$executeRaw`INSERT INTO users VALUES (${owner}, ${customer})`
      await save('real', 'pi_real')
      await save('credits', 'pi_credits', { kind: 'CREDIT_PAYMENT', currency: 'eur', amount: 2000, userId: null })
      await save('trial', 'pi_trial', { amount: 0 })
      await save('refund', 'pi_real', { kind: 'REFUND', amount: 500 })
      await save('old', 'pi_repeat', { age: 10 })
      await save('duplicate', 'pi_repeat')
      await save('future', 'pi_future', { recordedAt: new Date(now.getTime() + day) })
      await save('unknown', null)
      await save('badRef', 'private@example.test')
      await save('test', 'pi_test')
      await save('uncaptured', 'pi_uncaptured')
      await save('wrongcustomer', 'pi_wrongcustomer')
      await save('wronginvoice', 'pi_wronginvoice')
      await save('wrongamount', 'pi_wrongamount')
      await save('wrongcurrency', 'pi_wrongcurrency')
      await save('error', 'pi_error')
      const retrieve = vi.fn(async (id: string) => {
        if (id === 'pi_error') throw new Error('private Stripe error with sk_live_fixture')
        if (id === 'pi_test') return intent(id, { test: true })
        if (id === 'pi_uncaptured') return intent(id, { captured: false })
        if (id === 'pi_wrongcustomer') return intent(id, { customer: 'cus_different' })
        if (id === 'pi_wronginvoice') return intent(id, { invoice: 'in_other' })
        if (id === 'pi_wrongamount') return intent(id, { amount: 1000 })
        if (id === 'pi_wrongcurrency') return intent(id, { currency: 'eur' })
        if (id === 'pi_credits') return intent(id, { amount: 2000, currency: 'eur', invoice: null })
        return intent(id)
      })
      const report = await inspectCommercialEvidence({ since, now, verification: { status: 'live-requested', retrieve } }, db)
      expect(report).toMatchObject({
        databaseWritten: false, providerWritten: false,
        ledger: { retainedEntries: 14, positiveSucceededPaymentEntries: 12, zeroAmountSucceededPaymentEntries: 1,
          retainedRefundEntries: 1, eligibleForExactCaptureRead: 9 },
        verification: { status: 'attempted', confirmedCaptures: 2, distinctCurrentOwnersWithConfirmedCapture: 1,
          failedReads: 1, incompatibleCaptures: 6, confirmedGrossMinorByCurrency: [
            { currency: 'eur', capturedPayments: 1, grossMinor: 2000 },
            { currency: 'usd', capturedPayments: 1, grossMinor: 1500 },
          ] },
      })
      expect(retrieve.mock.calls.flat().sort()).toEqual([
        'pi_credits', 'pi_error', 'pi_real', 'pi_test', 'pi_uncaptured', 'pi_wrongamount', 'pi_wrongcurrency',
        'pi_wrongcustomer', 'pi_wronginvoice',
      ])
      for (const secret of [owner, customer, 'private@example.test', 'sk_live_fixture', 'pi_real']) {
        expect(JSON.stringify(report)).not.toContain(secret)
      }
      const command = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/growth/inspect-commercial-evidence.ts', '7', '--verify-live', '--after-claim', '--first-paid-invoice'], {
        env: { ...process.env, DATABASE_URL: url.toString(), STRIPE_SECRET_KEY: 'sk_test_fixture' }, encoding: 'utf8', timeout: 15_000,
      })
      expect(command.status).toBe(1)
      expect(command.stderr).toBe('')
      expect(JSON.parse(command.stdout).verification).toMatchObject({
        status: 'test-credential', confirmedCaptures: null, confirmedGrossMinorByCurrency: null,
      })
      expect(JSON.parse(command.stdout).postClaimInvoices).toMatchObject({ invoiceCandidates: 0, verifiedPaidInvoices: null })
      expect(JSON.parse(command.stdout).firstPaidInvoiceAfterClaim).toMatchObject({
        status: 'unavailable', customersWithVerifiedFirstPaidInvoice: null,
      })
      expect(command.stdout).not.toContain('sk_test_fixture')

      const previousOwner = 'private-previous-owner'
      const previousCustomer = 'cus_previous'
      const withoutCustomer = 'private-unbilled-owner'
      const withoutInvoice = 'private-owner-without-invoice'
      const immatureOwner = 'private-immature-owner'
      const suspendedOwner = 'private-suspended-owner'
      const when = (age: number) => new Date(now.getTime() - age * day)
      await db.$executeRaw`INSERT INTO users VALUES (${previousOwner}, ${previousCustomer})`
      await db.$executeRaw`INSERT INTO users VALUES (${withoutCustomer}, NULL), (${withoutInvoice}, 'cus_noinvoice'), (${immatureOwner}, NULL)`
      await db.$executeRaw`INSERT INTO users VALUES (${suspendedOwner}, 'cus_suspended', 'SUSPENDED')`
      await db.$executeRaw`CREATE TABLE site_lifecycle_events (id text, name text, version int, "projectId" text, "userId" text, "idempotencyKey" text, "createdAt" timestamp(3), properties jsonb)`
      await db.$executeRaw`CREATE TABLE projects (id text, "userId" text, "createdAt" timestamp(3), "deletedAt" timestamp(3))`
      await db.$executeRaw`CREATE TABLE audits (id text, "projectId" text, "userId" text, "createdAt" timestamp(3), "parentId" text, source text)`
      for (const [key, ownerId, age] of [
        ['current', owner, 29], ['oldclaim', previousOwner, 70], ['newclaim', previousOwner, 30],
        ['unbilled', withoutCustomer, 29], ['noinvoice', withoutInvoice, 29], ['immature', immatureOwner, 27],
        ['suspended', suspendedOwner, 29],
      ] as const) {
        await db.$executeRaw`INSERT INTO projects VALUES (${key}, ${ownerId}, ${when(age + 1)}, NULL)`
        await db.$executeRaw`INSERT INTO audits VALUES (${key}, ${key}, ${ownerId}, ${when(age + 1)}, NULL, 'HOMEPAGE')`
        await db.$executeRaw`INSERT INTO site_lifecycle_events VALUES (${key}, 'analysis_claimed', 1, ${key}, ${ownerId},
          ${`analysis_claimed:${key}`}, ${when(age)}, '{}')`
      }
      for (const [id, age] of [['second', 4], ['invoicetime', 2], ['invoiceexternal', 3], ['beforeclaim', 35], ['lateinvoice', 0]] as const) {
        await save(id, `pi_${id}`, { age })
      }
      await save('olderclaim', 'pi_olderclaim', { userId: previousOwner, customerId: previousCustomer })
      await save('staleownerlink', 'pi_staleownerlink', { userId: withoutInvoice, customerId: 'cus_stale' })
      const offline = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/growth/inspect-commercial-evidence.ts', '60', '--after-claim'], {
        env: { ...process.env, DATABASE_URL: url.toString(), STRIPE_SECRET_KEY: 'sk_test_fixture' }, encoding: 'utf8', timeout: 15_000,
      })
      expect(offline.status).toBe(0)
      expect(offline.stderr).toBe('')
      const claimCounts = { matureExactClaimOwners: 3, ownersWithCurrentBillingCustomer: 2,
        ownersWithRetainedPositiveCurrentCustomerInvoice: 1, ownersWithoutRetainedPositiveCurrentCustomerInvoice: 2 }
      expect(JSON.parse(offline.stdout)).toMatchObject({
        verification: { status: 'not-requested' }, claimCohort: { status: 'available', counts: claimCounts },
        postClaimInvoices: { invoiceCandidates: 0, verifiedPaidInvoices: null },
      })
      expect(offline.stdout).not.toMatch(/private-|cus_|pi_/)
      const retrieveInvoice = vi.fn(async (id: string) => {
        const ages: Record<string, number> = { in_real: 1, in_second: 4, in_invoicetime: 3, in_invoiceexternal: 3 }
        return { id, object: 'invoice', livemode: true, status: 'paid', paid: true,
          paid_out_of_band: id === 'in_invoiceexternal', payment_intent: `pi_${id.slice(3)}`, customer,
          amount_paid: 1500, currency: 'usd', status_transitions: { paid_at: when(ages[id]).getTime() / 1000 },
          customer_email: 'private-invoice@example.test',
        } as unknown as Stripe.Invoice
      })
      const postClaimInput = { since: when(60), now, includePostClaimInvoices: true,
        verification: { status: 'live-requested' as const, retrieve: async (id: string) =>
          id === 'pi_olderclaim' ? intent(id, { customer: previousCustomer }) : retrieve(id), retrieveInvoice } }
      const postClaim = await inspectCommercialEvidence(postClaimInput, db)
      expect(postClaim.claimCohort).toMatchObject({ status: 'available', counts: claimCounts })
      expect(postClaim.postClaimInvoices).toMatchObject({
        followupDays: 28, invoiceCandidates: 4, invoiceReadFailures: 0, incompatibleInvoices: 2,
        verifiedPaidInvoices: 2, ownersWithVerifiedPaidInvoice: 1,
      })
      expect(retrieveInvoice.mock.calls.flat().sort()).toEqual(['in_invoiceexternal', 'in_invoicetime', 'in_real', 'in_second'])
      expect(JSON.stringify(postClaim)).not.toMatch(/private-|cus_previous|pi_olderclaim|in_real/)

      const laterInvoice = await retrieveInvoice('in_real')
      const firstInvoice = await retrieveInvoice('in_second')
      const paidHistory = (data: Stripe.Invoice[], has_more = false) =>
        ({ object: 'list' as const, url: '/v1/invoices', data, has_more })
      const freeInvoice = { ...firstInvoice, id: 'in_trial', amount_paid: 0,
        status_transitions: { ...firstInvoice.status_transitions, paid_at: when(50).getTime() / 1000 } }
      const listPaidInvoices = vi.fn<(customerId: string) => Promise<Stripe.ApiList<Stripe.Invoice>>>(
        async () => paidHistory([laterInvoice, freeInvoice, firstInvoice]))
      const firstPaidInput = { ...postClaimInput, includeFirstPaidInvoice: true,
        verification: { ...postClaimInput.verification, listPaidInvoices } }
      const firstPaid = await inspectCommercialEvidence(firstPaidInput, db)
      expect(firstPaid.firstPaidInvoiceAfterClaim).toMatchObject({
        status: 'available', customersWithVerifiedPostClaimInvoice: 1, customersWithVerifiedFirstPaidInvoice: 1,
        earlierPaidInvoiceCustomers: 0, historyPageLimit: 100,
      })
      expect(listPaidInvoices.mock.calls).toEqual([[customer]])
      expect(JSON.stringify(firstPaid)).not.toMatch(/private-|in_real|in_second|in_trial/)

      const earlier = { ...firstInvoice, id: 'in_prior', paid_out_of_band: true,
        status_transitions: { ...firstInvoice.status_transitions, paid_at: when(40).getTime() / 1000 } }
      listPaidInvoices.mockResolvedValueOnce(paidHistory([laterInvoice, earlier, firstInvoice]))
      expect((await inspectCommercialEvidence(firstPaidInput, db)).firstPaidInvoiceAfterClaim)
        .toMatchObject({ status: 'available', customersWithVerifiedFirstPaidInvoice: 0, earlierPaidInvoiceCustomers: 1 })
      for (const [page, reason] of [
        [paidHistory([firstInvoice, laterInvoice], true), 'incompleteHistories'],
        [paidHistory([firstInvoice]), 'incompatibleHistories'],
        [paidHistory([firstInvoice, laterInvoice, { ...earlier, customer: previousCustomer }]), 'incompatibleHistories'],
        [paidHistory([firstInvoice, laterInvoice, { ...earlier,
          status_transitions: { ...earlier.status_transitions, paid_at: null } }]), 'incompatibleHistories'],
        [paidHistory([firstInvoice, laterInvoice, { ...earlier, status_transitions: firstInvoice.status_transitions }]), 'ambiguousFirstPaidTimes'],
      ] as const) {
        listPaidInvoices.mockResolvedValueOnce(page)
        expect((await inspectCommercialEvidence(firstPaidInput, db)).firstPaidInvoiceAfterClaim)
          .toMatchObject({ status: 'partial', customersWithVerifiedFirstPaidInvoice: null, [reason]: 1 })
      }
      listPaidInvoices.mockRejectedValueOnce(new Error('private Stripe history response'))
      expect((await inspectCommercialEvidence(firstPaidInput, db)).firstPaidInvoiceAfterClaim)
        .toMatchObject({ status: 'partial', customersWithVerifiedFirstPaidInvoice: null, historyReadFailures: 1 })

      const guide = 'website-online-but-not-working'
      const startsAt = when(29.5)
      const endExclusive = new Date((Math.floor(startsAt.getTime() / day) + 1) * day)
      const start = new Date(endExclusive.getTime() - 28 * day)
      const fullyMatureAt = new Date(endExclusive.getTime() + 35 * day)
      await db.$executeRaw`INSERT INTO site_lifecycle_events VALUES ('private-start', 'analyze_started', 1, NULL, NULL,
        'analyze_started:current', ${startsAt}, ${JSON.stringify({ anonymous: true, guideEntry: guide, journeyId: 'ffj_' + 'c'.repeat(32) })}::jsonb)`
      await db.$executeRaw`INSERT INTO site_lifecycle_events VALUES ('private-start-noinvoice', 'analyze_started', 1, NULL, NULL,
        'analyze_started:noinvoice', ${startsAt}, ${JSON.stringify({ anonymous: true, guideEntry: guide, journeyId: 'ffj_' + 'd'.repeat(32) })}::jsonb)`
      const guideInput = { since: start, now: fullyMatureAt, includePostClaimInvoices: true,
        guideWindow: { guide, start, endExclusive } as const, verification: { status: 'live-requested' as const, retrieve, retrieveInvoice } }
      retrieve.mockClear()
      retrieveInvoice.mockClear()
      listPaidInvoices.mockClear()
      const scoped = await inspectCommercialEvidence({ ...guideInput, includeFirstPaidInvoice: true,
        verification: { ...guideInput.verification, listPaidInvoices } }, db)
      expect(readDestinationStudyCommercial(scoped, start, endExclusive)).toMatchObject({
        claimCohortStatus: 'available', postClaimInvoices: { verifiedPaidInvoices: 2, ownersWithVerifiedPaidInvoice: 1 },
      })
      expect(scoped).toMatchObject({
        guideCohort: { guide, fullyMature: true, billingEvidenceThrough: fullyMatureAt.toISOString() },
        postClaimInvoices: { invoiceCandidates: 5, incompatibleInvoices: 3, verifiedPaidInvoices: 2, ownersWithVerifiedPaidInvoice: 1 },
        firstPaidInvoiceAfterClaim: { status: 'available', customersWithVerifiedFirstPaidInvoice: 1 },
        claimCohort: { status: 'available', counts: { matureExactClaimOwners: 2, ownersWithCurrentBillingCustomer: 2,
          ownersWithRetainedPositiveCurrentCustomerInvoice: 1, ownersWithoutRetainedPositiveCurrentCustomerInvoice: 1 } },
      })
      expect(listPaidInvoices.mock.calls).toEqual([[customer]])
      expect(retrieve.mock.calls.flat().filter(id => ['pi_credits', 'pi_olderclaim', 'pi_beforeclaim', 'pi_lateinvoice'].includes(id))).toEqual([])
      // The later guide read can see a ledger row that was recorded after the earlier report.
      expect(retrieveInvoice.mock.calls.flat().sort()).toEqual(['in_future', 'in_invoiceexternal', 'in_invoicetime', 'in_real', 'in_second'])
      expect(JSON.stringify(scoped)).not.toMatch(/private-|ffj_|cus_previous|pi_olderclaim|in_real/)

      retrieve.mockClear()
      retrieveInvoice.mockClear()
      listPaidInvoices.mockClear()
      expect(await inspectCommercialEvidence({ ...guideInput, includeFirstPaidInvoice: true,
        verification: { ...guideInput.verification, listPaidInvoices }, now: new Date(fullyMatureAt.getTime() - 1) }, db)).toMatchObject({
        guideCohort: { fullyMature: false },
        verification: { status: 'guide-followup-incomplete', confirmedCaptures: null },
        claimCohort: { status: 'guide-followup-incomplete', counts: null },
        firstPaidInvoiceAfterClaim: { status: 'no-verified-post-claim-invoices', customersWithVerifiedFirstPaidInvoice: null },
      })
      expect(listPaidInvoices).not.toHaveBeenCalled()
      await db.$executeRaw`UPDATE site_lifecycle_events SET "idempotencyKey" = 'analyze_started:different-audit' WHERE id = 'private-start'`
      expect(await inspectCommercialEvidence(guideInput, db)).toMatchObject({
        verification: { status: 'no-eligible-ledger-rows' }, postClaimInvoices: { verifiedPaidInvoices: null },
      })
      await db.$executeRaw`UPDATE site_lifecycle_events SET "idempotencyKey" = 'analyze_started:current' WHERE id = 'private-start'`
      await db.$executeRaw`INSERT INTO site_lifecycle_events VALUES ('private-earlier', 'analysis_claimed', 1,
        'current', ${previousOwner}, 'analysis_claimed:earlier', ${when(31)}, '{}')`
      expect(await inspectCommercialEvidence(guideInput, db)).toMatchObject({
        verification: { status: 'no-eligible-ledger-rows' }, postClaimInvoices: { verifiedPaidInvoices: null },
      })
      expect(retrieve).not.toHaveBeenCalled()
      expect(retrieveInvoice).not.toHaveBeenCalled()

      await db.$executeRaw`
        INSERT INTO site_lifecycle_events
        SELECT 'excess-' || number, 'analysis_claimed', 1, NULL, 'private-excess-' || number,
          'analysis_claimed:excess-' || number, ${when(35)}, '{}'::jsonb
        FROM generate_series(1, 5001) AS number
      `
      expect((await inspectCommercialEvidence({ ...postClaimInput, verification: { status: 'not-requested' } }, db)).claimCohort)
        .toMatchObject({ status: 'claim-owner-limit-exceeded', counts: null })
      await db.$executeRaw`DELETE FROM site_lifecycle_events WHERE id LIKE 'excess-%'`

      await db.$executeRaw`
        INSERT INTO billing_ledger_entries
        SELECT 'extra' || number, 'in_extra' || number, 'INVOICE_PAYMENT', NULL, NULL,
          'pi_extra' || number, 100, 'usd', 'SUCCEEDED', ${since}, ${since}
        FROM generate_series(1, 51) AS number
      `
      retrieve.mockClear()
      const bounded = await inspectCommercialEvidence({ since, now, verification: { status: 'live-requested', retrieve } }, db)
      expect(bounded.verification).toMatchObject({ status: 'candidate-limit-exceeded', confirmedCaptures: null })
      expect(retrieve).not.toHaveBeenCalled()
      await db.$executeRaw`DELETE FROM site_lifecycle_events WHERE id = 'private-earlier'`
      expect(await inspectCommercialEvidence(guideInput, db)).toMatchObject({
        verification: { status: 'attempted' }, postClaimInvoices: { verifiedPaidInvoices: 2 },
      })
      expect(retrieve.mock.calls.length).toBeGreaterThan(0)
      expect(retrieve.mock.calls.flat().some(id => id.startsWith('pi_extra'))).toBe(false)
    } finally {
      await db.$disconnect()
      await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
      await admin.$disconnect()
    }
  })
})
