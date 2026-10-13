import { describe, it, expect, vi } from 'vitest'
import type Stripe from 'stripe'
import { recordPaidInvoice, recordProviderRefund, formatMoneyMinor } from '@/lib/billing/ledger'
import { subscriptionPhaseSettings } from '../subscription-phase'
import { adminExecutionSummary } from '../evidence'
describe('provider and private evidence contracts', () => {
  it('records the invoice amount actually paid, independent of account count or list prices', async () => {
    const upsert = vi.fn(),
      tx = {
        $executeRaw: vi.fn(),
        billingLedgerEntry: { upsert, findFirst: vi.fn(async () => null) },
      }
    await recordPaidInvoice(
      tx as never,
      {
        id: 'in_paid',
        subscription: 'sub',
        customer: 'cus',
        lines: { data: [] },
        payment_intent: 'pi',
        amount_paid: 2795,
        currency: 'eur',
        status_transitions: { paid_at: 1791892800 },
      } as unknown as Stripe.Invoice,
      null,
      new Date(),
    )
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          kind: 'INVOICE_PAYMENT',
          amountMinor: 2795,
          currency: 'eur',
          userId: null,
        }),
      }),
    )
    expect(formatMoneyMinor(1500, 'jpy')).toContain('1,500')
  })
  it('does not regress an observed successful refund with an older pending event', async () => {
    const upsert = vi.fn(),
      tx = {
        $executeRaw: vi.fn(),
        billingLedgerEntry: {
          findUnique: vi.fn(async () => ({ recordedAt: new Date('2026-10-13T12:00:00Z') })),
          upsert,
        },
      }
    await recordProviderRefund(
      tx as never,
      { id: 're', status: 'pending', amount: 25, currency: 'usd', created: 1 } as Stripe.Refund,
      { userId: null, customerId: null },
      new Date('2026-10-13T11:00:00Z'),
    )
    expect(upsert).not.toHaveBeenCalled()
  })
  it('preserves discounts, tax, invoice terms, and metadata in scheduled changes', () => {
    const phase = {
      application_fee_percent: null,
      automatic_tax: { enabled: true },
      billing_cycle_anchor: 'automatic',
      billing_thresholds: null,
      collection_method: 'send_invoice',
      currency: 'eur',
      default_payment_method: 'pm',
      default_tax_rates: [{ id: 'tx' }],
      description: 'Existing terms',
      discounts: [{ coupon: 'coupon', discount: null, promotion_code: null }],
      invoice_settings: { days_until_due: 15, account_tax_ids: ['taxid'] },
      metadata: { cohort: 'existing' },
      on_behalf_of: null,
      transfer_data: null,
    } as unknown as Stripe.SubscriptionSchedule.Phase
    expect(subscriptionPhaseSettings(phase)).toMatchObject({
      automatic_tax: { enabled: true },
      default_tax_rates: ['tx'],
      discounts: [{ coupon: 'coupon' }],
      invoice_settings: { days_until_due: 15 },
      metadata: { cohort: 'existing' },
      collection_method: 'send_invoice',
    })
  })
  it('never returns executable configuration values in the evidence scope', () => {
    const spec = {
      version: 1,
      targetUrl: 'https://private.invalid',
      environment: 'production',
      scope: 'OUTCOMES',
      checks: { test: 1 },
      outcomes: [
        {
          id: 'o',
          kind: 'SIGNUP',
          expectation: null,
          bindingPolicy: 'ALL',
          bindings: [
            {
              key: 'b',
              version: 1,
              mechanism: 'BROWSER_JOURNEY',
              required: true,
              config: { steps: [{ name: 'password', value: 'private-password' }] },
            },
          ],
        },
      ],
      verificationTarget: null,
    }
    const summary = JSON.stringify(adminExecutionSummary(spec))
    expect(summary).toContain('BROWSER_JOURNEY')
    expect(summary).not.toContain('private-password')
    expect(summary).not.toContain('private.invalid')
  })
})
