import Link from 'next/link'
import { requireAdminPage } from '@/lib/auth/require-admin-page'
import { loadAdminBilling } from '@/lib/admin/workspace-queries'
import { formatMoneyMinor, currencyMinorDigits } from '@/lib/billing/ledger'
import { formatUsd } from '@/lib/billing/costs'
import { adminDate } from '@/lib/admin/format'
import { AdminPageFrame, AdminSurface } from '@/components/admin/AdminPageFrame'
import { RefundControl } from '@/components/admin/RefundControl'
import { AdminListSearch, AdminPagination } from '@/components/admin/AdminListControls'
export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const actor = await requireAdminPage()
  const data = await loadAdminBilling(actor, await searchParams)
  return (
    <AdminPageFrame
      title="Billing"
      description="Confirmed provider payments and refunds. Pending outcomes remain pending."
    >
      <AdminListSearch
        path="/admin/billing"
        q={data.q}
        label="Search customer or provider payment ID"
      />
      <AdminSurface title="Cash recorded in the last seven days">
        <div className="grid gap-4 md:grid-cols-3">
          {data.cashTotals.map((cash) => (
            <div key={cash.currency} className="space-y-2">
              <h3 className="font-semibold">{cash.currency.toUpperCase()}</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt>Received</dt>
                  <dd>{formatMoneyMinor(cash.received, cash.currency)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Refunded</dt>
                  <dd>{formatMoneyMinor(cash.refunded, cash.currency)}</dd>
                </div>
                <div className="flex justify-between gap-3 font-medium">
                  <dt>Net cash</dt>
                  <dd>{formatMoneyMinor(cash.net, cash.currency)}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
        {!data.cash.length && (
          <p className="text-sm text-muted-foreground">
            No confirmed payments recorded for this view.
          </p>
        )}
      </AdminSurface>
      <AdminSurface title="Estimated run costs in the last seven days">
        <p>
          {formatUsd(data.estimatedCost)} across {data.priced} priced runs.
        </p>
        <p className="text-sm text-muted-foreground">
          {data.unpriced} runs are not priced. {data.legacy} legacy estimates are excluded.{' '}
          {data.missing} finished checks have no cost record. Estimates exclude provider fees, tax,
          and other operating expenses.
        </p>
      </AdminSurface>
      <div className="space-y-3">
        {data.rows.map((payment) => (
          <AdminSurface key={payment.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 className="font-semibold">
                  {formatMoneyMinor(payment.amountMinor, payment.currency)} ·{' '}
                  {payment.kind.replaceAll('_', ' ').toLowerCase()}
                </h2>
                <p className="text-sm">
                  {payment.status} · {adminDate(payment.occurredAt)}
                </p>
                <p className="break-all text-xs text-muted-foreground">
                  Provider record: {payment.providerId}
                </p>
                {payment.userId && (
                  <Link href={`/admin/users/${payment.userId}`} className="text-sm underline">
                    {payment.user?.email ?? 'Customer'}
                  </Link>
                )}
              </div>
              {payment.kind !== 'REFUND' &&
                payment.status === 'SUCCEEDED' &&
                payment.refundableMinor > 0 && (
                  <RefundControl
                    id={payment.id}
                    amountMinor={payment.refundableMinor}
                    currency={payment.currency}
                    digits={currencyMinorDigits(payment.currency)}
                  />
                )}
            </div>
          </AdminSurface>
        ))}
      </div>
      <AdminPagination
        path="/admin/billing"
        {...data.pagination}
        total={data.total}
        filters={{ q: data.q }}
      />
    </AdminPageFrame>
  )
}
