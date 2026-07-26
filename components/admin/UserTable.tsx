'use client'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  AdminTable,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeaderCell,
  AdminTableRow,
} from '@/components/admin/AdminTable'

interface User {
  id: string
  email: string
  name: string | null
  plan: string
  role: string
  auditsUsed: number
  auditsLimit: number
  createdAt: Date | string
  totalCostLabel: string
}

const planColors: Record<string, string> = {
  FREE: 'bg-muted text-muted-foreground',
  BUILDER: 'bg-grade-B/15 text-grade-B border-grade-B/25',
  TEAM: 'bg-brand/10 text-brand border-brand/25',
}

function formatLimit(limit: number): string {
  return limit === -1 ? 'Unlimited' : String(limit)
}

export function UserTable({ users }: { users: User[] }) {
  const [updating, setUpdating] = useState<string | null>(null)

  async function changePlan(userId: string, plan: string) {
    setUpdating(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      if (res.ok) {
        toast.success('Plan updated')
        window.location.reload()
      } else {
        toast.error('Failed to update plan')
      }
    } finally {
      setUpdating(null)
    }
  }

  return (
    <AdminTable isEmpty={users.length === 0} emptyMessage="No users yet.">
      <AdminTableHead>
        <AdminTableHeaderCell>Email</AdminTableHeaderCell>
        <AdminTableHeaderCell>Plan</AdminTableHeaderCell>
        <AdminTableHeaderCell>Checks</AdminTableHeaderCell>
        <AdminTableHeaderCell>Est. cost</AdminTableHeaderCell>
        <AdminTableHeaderCell>Joined</AdminTableHeaderCell>
        <AdminTableHeaderCell />
      </AdminTableHead>
        <tbody>
          {users.map((user, i) => (
            <AdminTableRow key={user.id} index={i}>
              <AdminTableCell>
                <div className="font-medium truncate max-w-[200px]">{user.email}</div>
                {user.name && <div className="text-xs text-muted-foreground">{user.name}</div>}
                {user.role === 'admin' && (
                  <Badge className="text-xs mt-1" variant="destructive">Admin</Badge>
                )}
              </AdminTableCell>
              <AdminTableCell>
                <Badge className={cn('text-xs', planColors[user.plan] ?? '')}>{user.plan}</Badge>
              </AdminTableCell>
              <AdminTableCell className="text-muted-foreground">
                {user.auditsUsed} / {formatLimit(user.auditsLimit)}
              </AdminTableCell>
              <AdminTableCell className="text-muted-foreground">{user.totalCostLabel}</AdminTableCell>
              <AdminTableCell className="text-xs text-muted-foreground">
                {new Date(user.createdAt).toLocaleDateString()}
              </AdminTableCell>
              <AdminTableCell>
                {user.role !== 'admin' && (
                  <select
                    disabled={updating === user.id}
                    defaultValue=""
                    onChange={(e) => { if (e.target.value) changePlan(user.id, e.target.value) }}
                    className="text-xs border rounded px-2 py-1 bg-background"
                  >
                    <option value="" disabled>Change plan…</option>
                    {['FREE', 'BUILDER', 'TEAM'].map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                )}
              </AdminTableCell>
            </AdminTableRow>
          ))}
        </tbody>
    </AdminTable>
  )
}
