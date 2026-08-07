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
import { toast } from 'sonner'
import { useState } from 'react'

interface Props {
  rows: WaitlistRow[]
}

interface InviteActionResponse {
  ok?: boolean
  invites?: Array<{ joinUrl?: string; code?: string }>
  updated?: number
  granted?: number
  error?: string
}

async function postInviteAction(
  entryId: string,
  action: 'invite' | 'grant' | 'assign_batch',
  batch?: 1 | 2
): Promise<InviteActionResponse> {
  const response = await fetch(`/api/admin/waitlist/${entryId}/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...(batch ? { batch } : {}) }),
  })
  const data = (await response.json().catch(() => ({}))) as InviteActionResponse
  if (!response.ok) throw new Error(data.error ?? 'Request failed')
  return data
}

export function WaitlistTable({ rows }: Props) {
  const [busy, setBusy] = useState<{ id: string; action: string } | null>(null)

  async function run(
    rowId: string,
    action: 'invite' | 'grant' | 'assign_batch',
    batch?: 1 | 2
  ) {
    setBusy({ id: rowId, action })
    try {
      const data = await postInviteAction(rowId, action, batch)
      if (action === 'invite') {
        const joinUrl = data.invites?.[0]?.joinUrl
        if (joinUrl) {
          await navigator.clipboard?.writeText(joinUrl).catch(() => undefined)
          toast.success('Invite created. Link copied to clipboard.')
        } else {
          toast.success('Invite created.')
        }
      } else if (action === 'grant') {
        toast.success(data.granted ? 'Access granted.' : 'Already granted.')
      } else {
        toast.success(`Batch ${batch} assigned.`)
      }
      window.location.reload()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <AdminTable emptyMessage="No waitlist entries yet." isEmpty={rows.length === 0}>
      <AdminTableHead>
        <AdminTableHeaderCell>Email</AdminTableHeaderCell>
        <AdminTableHeaderCell>Account</AdminTableHeaderCell>
        <AdminTableHeaderCell>Plan</AdminTableHeaderCell>
        <AdminTableHeaderCell>Tier</AdminTableHeaderCell>
        <AdminTableHeaderCell>Batch</AdminTableHeaderCell>
        <AdminTableHeaderCell>Access</AdminTableHeaderCell>
        <AdminTableHeaderCell>Invite</AdminTableHeaderCell>
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
            <AdminTableCell className="font-mono text-xs">
              {row.batch ? `B${row.batch}` : '-'}
            </AdminTableCell>
            <AdminTableCell className="text-xs tabular-nums">
              {row.accessGrantedAt ? row.accessGrantedAt.toISOString().slice(0, 10) : '-'}
            </AdminTableCell>
            <AdminTableCell className="font-mono text-xs">
              {row.inviteCode ? (
                <button
                  type="button"
                  className="text-xs text-brand underline underline-offset-2"
                  title="Copy invite link"
                  onClick={() => {
                    const link = `${window.location.origin}/waitlist/${
                      row.plan === 'TEAM' ? 'studio' : 'pro'
                    }?code=${row.inviteCode}`
                    void navigator.clipboard?.writeText(link)
                    toast.success('Invite link copied.')
                  }}
                >
                  {row.inviteCode}
                </button>
              ) : (
                '-'
              )}
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
              <div className="flex items-center gap-1">
                {row.batch !== 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy?.id === row.id}
                    onClick={() => run(row.id, 'assign_batch', 1)}
                  >
                    B1
                  </Button>
                )}
                {row.batch !== 2 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy?.id === row.id}
                    onClick={() => run(row.id, 'assign_batch', 2)}
                  >
                    B2
                  </Button>
                )}
                {!row.inviteCode && (
                  <Button
                    size="sm"
                    variant="outline"
                    loading={busy?.id === row.id && busy.action === 'invite'}
                    disabled={busy?.id === row.id}
                    onClick={() => run(row.id, 'invite')}
                  >
                    Invite
                  </Button>
                )}
                {!row.accessGrantedAt && (
                  <Button
                    size="sm"
                    variant="outline"
                    loading={busy?.id === row.id && busy.action === 'grant'}
                    disabled={busy?.id === row.id}
                    onClick={() => run(row.id, 'grant')}
                  >
                    Grant
                  </Button>
                )}
              </div>
            </AdminTableCell>
          </AdminTableRow>
        ))}
      </tbody>
    </AdminTable>
  )
}
