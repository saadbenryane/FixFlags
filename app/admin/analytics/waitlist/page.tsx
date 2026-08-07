import Link from 'next/link'
import {
  AdminTable,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeaderCell,
  AdminTableRow,
} from '@/components/admin/AdminTable'
import { MetricCard } from '@/components/admin/MetricCard'
import { Container } from '@/components/ui/container'
import { PageHeader } from '@/components/layout/PageHeader'
import { SectionTitle } from '@/components/ui/typography'
import { CsvDownloadButton } from './csv-download'
import {
  buildFunnel,
  capRowsToCsv,
  conversionRowsToCsv,
  getWaitlistConversionData,
  waitlistEntryStatsToCsv,
} from '@/lib/analytics/waitlist-conversion'

const PLAN_LABELS: Record<string, string> = { BUILDER: 'Pro', TEAM: 'Studio' }

export default async function AdminWaitlistAnalyticsPage() {
  const data = await getWaitlistConversionData()
  const dateStamp = new Date().toISOString().slice(0, 10)

  const funnelTotals = buildFunnel(data.entries)
  const topConversion = [...data.conversionRows]
    .filter((row) => row.signups > 0)
    .sort((a, b) => b.conversionRate - a.conversionRate)[0]

  return (
    <Container variant="wide" className="space-y-8 py-8">
      <PageHeader
        title="Waitlist conversion"
        description="Launch promise: waitlist signups to paid plans by discount tier, cap fill, and funnel drop-off. T1 = first 500 (25% off), T2 = next 500 (15% off), None = list price. Caps are per plan."
      >
        <Link
          href="/admin/analytics"
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          &larr; Funnel analytics
        </Link>
        <Link
          href="/admin/waitlist"
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          Open waitlist admin &rarr;
        </Link>
        <CsvDownloadButton
          label="CSV: conversion rows"
          filename={`waitlist-conversion-${dateStamp}.csv`}
          csv={conversionRowsToCsv(data.conversionRows)}
        />
        <CsvDownloadButton
          label="CSV: cap fill"
          filename={`waitlist-cap-fill-${dateStamp}.csv`}
          csv={capRowsToCsv(data.capRows)}
        />
        <CsvDownloadButton
          label="CSV: waitlist entries"
          filename={`waitlist-conversion-entries-${dateStamp}.csv`}
          csv={waitlistEntryStatsToCsv(data.entries)}
        />
      </PageHeader>

      <section className="space-y-4">
        <SectionTitle>Funnel (all time)</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {funnelTotals.map((stage) => (
            <MetricCard
              key={stage.key}
              label={stage.label}
              value={stage.count.toLocaleString()}
              detail={
                stage.key === 'signups' ? (
                  <span className="text-xs text-muted-foreground">Joined the paid plan waitlist</span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {stage.delta < 0
                      ? `${stage.dropOffPercent}% drop-off (${Math.abs(stage.delta).toLocaleString()} left)`
                      : `${stage.delta.toLocaleString()} from previous stage`}
                  </span>
                )
              }
              variant="subtle"
            />
          ))}
        </div>
        {topConversion && topConversion.signups > 0 && (
          <p className="text-xs text-muted-foreground">
            Highest conversion today: {PLAN_LABELS[topConversion.plan]} {topConversion.tierLabel} at{' '}
            {topConversion.conversionRate}%.
          </p>
        )}
      </section>

      <section className="space-y-4">
        <SectionTitle>Cap fill-status</SectionTitle>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Tiers are snapshots at join time, assigned by join order under a per-plan lock: the first 500
          members of each plan hold a 25% slot, the next 500 a 15% slot. Remaining capacity is the cap
          minus claimed slots.
        </p>
        <AdminTable emptyMessage="No waitlist entries yet." isEmpty={data.capRows.length === 0}>
          <AdminTableHead>
            <AdminTableHeaderCell>Plan</AdminTableHeaderCell>
            <AdminTableHeaderCell>Tier</AdminTableHeaderCell>
            <AdminTableHeaderCell>Cap</AdminTableHeaderCell>
            <AdminTableHeaderCell>Claimed</AdminTableHeaderCell>
            <AdminTableHeaderCell>Remaining</AdminTableHeaderCell>
            <AdminTableHeaderCell>Fill</AdminTableHeaderCell>
          </AdminTableHead>
          <tbody>
            {data.capRows.map((row, index) => (
              <AdminTableRow key={`${row.plan}-${row.tier}`} index={index}>
                <AdminTableCell>{PLAN_LABELS[row.plan] ?? row.plan}</AdminTableCell>
                <AdminTableCell>{row.tierLabel}</AdminTableCell>
                <AdminTableCell className="font-mono text-xs tabular-nums">
                  {row.cap?.toLocaleString() ?? '-'}
                </AdminTableCell>
                <AdminTableCell className="font-mono text-xs tabular-nums">
                  {row.claimed.toLocaleString()}
                </AdminTableCell>
                <AdminTableCell className="font-mono text-xs tabular-nums">
                  {row.remaining.toLocaleString()}
                </AdminTableCell>
                <AdminTableCell className="font-mono text-xs tabular-nums">
                  {row.fillPercent}%
                </AdminTableCell>
              </AdminTableRow>
            ))}
          </tbody>
        </AdminTable>
      </section>

      <section className="space-y-4">
        <SectionTitle>Conversion by discount tier</SectionTitle>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Purchased = account currently on a paid plan with an active Stripe subscription (ACTIVE or
          TRIALING), the same rule the checkout webhook uses. Invited counts members who received a
          launch invite.
        </p>
        <AdminTable
          emptyMessage="No waitlist entries yet."
          isEmpty={data.conversionRows.length === 0}
        >
          <AdminTableHead>
            <AdminTableHeaderCell>Plan</AdminTableHeaderCell>
            <AdminTableHeaderCell>Tier</AdminTableHeaderCell>
            <AdminTableHeaderCell>Signups</AdminTableHeaderCell>
            <AdminTableHeaderCell>Invited</AdminTableHeaderCell>
            <AdminTableHeaderCell>Purchased</AdminTableHeaderCell>
            <AdminTableHeaderCell>Conversion</AdminTableHeaderCell>
          </AdminTableHead>
          <tbody>
            {data.conversionRows.map((row, index) => (
              <AdminTableRow key={`${row.plan}-${row.tier}`} index={index}>
                <AdminTableCell>{PLAN_LABELS[row.plan] ?? row.plan}</AdminTableCell>
                <AdminTableCell>{row.tierLabel}</AdminTableCell>
                <AdminTableCell className="font-mono text-xs tabular-nums">
                  {row.signups.toLocaleString()}
                </AdminTableCell>
                <AdminTableCell className="font-mono text-xs tabular-nums">
                  {row.invited.toLocaleString()}
                </AdminTableCell>
                <AdminTableCell className="font-mono text-xs tabular-nums">
                  {row.purchased.toLocaleString()}
                </AdminTableCell>
                <AdminTableCell className="font-mono text-xs tabular-nums">
                  {row.signups > 0 ? `${row.conversionRate}%` : '-'}
                </AdminTableCell>
              </AdminTableRow>
            ))}
          </tbody>
        </AdminTable>
      </section>
    </Container>
  )
}
