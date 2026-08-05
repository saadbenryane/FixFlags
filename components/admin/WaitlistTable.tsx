'use client'

import {
  AdminTable,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeaderCell,
  AdminTableRow,
} from '@/components/admin/AdminTable'
import type { WaitlistRow } from '@/lib/billing/waitlist-segments'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

interface Props {
  rows: WaitlistRow[]
}

export function WaitlistTable({ rows }: Props) {
  const [invitingId, setInvitingId] = useState<string | null>(null)

  async function markInvited(id: string) {
    setInvitingId(id)
    try {
      await fetch(`/api/admin/waitlist/${id}/invite`, { method: 'POST' })
      window.location.reload()
    } finally {
      setInvitingId(null)
    }
  }

  return (
    <AdminTable emptyMessage="No waitlist entries yet." isEmpty={rows.length === 0}>
      <AdminTableHead>
        <AdminTableHeaderCell>Email</AdminTableHeaderCell>
        <AdminTableHeaderCell>Account</AdminTableHeaderCell>
        <AdminTableHeaderCell>Plan</AdminTableHeaderCell>
        <AdminTableHeaderCell>Tier</AdminTableHeaderCell>
        <AdminTableHeaderCell>Joined</AdminTableHeaderCell>
        <AdminTableHeaderCell>Source</AdminTableHeaderCell>
        <AdminTableHeaderCell>Usage</AdminTableHeaderCell>
        <AdminTableHeaderCell>Segment</AdminTableHeaderCell>
        <AdminTableHeaderCell>Invited</AdminTableHeaderCell>
        <AdminTableHeaderCell>Converted</AdminTableHeaderCell>
        <AdminTableHeaderCell />
      </AdminTableHead>
      <tbody>
        {rows.map((row, index) => (
          <AdminTableRow key={row.id} index={index}>
            <AdminTableCell className="font-mono text-xs">{row.email}</AdminTableCell>
            <AdminTableCell className="font-mono text-xs text-muted-foreground">
              {row.accountEmail === row.email ? '-' : row.accountEmail}
            </AdminTableCell>
            <AdminTableCell>{row.plan === 'TEAM' ? 'Studio' : 'Pro'}</AdminTableCell>
            <AdminTableCell>
              {row.discountTier === 1
                ? 'T1 · 25%'
                : row.discountTier === 2
                  ? 'T2 · 15%'
                  : 'None'}
            </AdminTableCell>
            <AdminTableCell className="text-xs tabular-nums">
              {row.joinedAt.toISOString().slice(0, 10)}
            </AdminTableCell>
            <AdminTableCell className="text-xs">{row.source ?? '-'}</AdminTableCell>
            <AdminTableCell className="text-xs tabular-nums">
              {row.auditsUsed}/{row.auditsLimit} · {row.completedAudits} done
            </AdminTableCell>
            <AdminTableCell className="text-xs">{row.segment}</AdminTableCell>
            <AdminTableCell className="text-xs tabular-nums">
              {row.invitedAt ? row.invitedAt.toISOString().slice(0, 10) : '-'}
            </AdminTableCell>
            <AdminTableCell className="text-xs tabular-nums">
              {row.convertedAt ? row.convertedAt.toISOString().slice(0, 10) : '-'}
            </AdminTableCell>
            <AdminTableCell>
              {!row.invitedAt && (
                <Button
                  size="sm"
                  variant="outline"
                  loading={invitingId === row.id}
                  onClick={() => markInvited(row.id)}
                >
                  Mark invited
                </Button>
              )}
            </AdminTableCell>
          </AdminTableRow>
        ))}
      </tbody>
    </AdminTable>
  )
}
