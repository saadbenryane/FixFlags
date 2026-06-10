'use client'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface User {
  id: string
  email: string
  name: string | null
  plan: string
  auditsUsed: number
  auditsLimit: number
  createdAt: Date | string
}

const planColors: Record<string, string> = {
  FREE: 'bg-muted text-muted-foreground',
  BUILDER: 'bg-blue-100 text-blue-800',
  TEAM: 'bg-purple-100 text-purple-800',
  STUDIO: 'bg-orange-100 text-orange-800',
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
    <div className="rounded-xl border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left px-4 py-3 font-medium">Email</th>
            <th className="text-left px-4 py-3 font-medium">Plan</th>
            <th className="text-left px-4 py-3 font-medium">Audits</th>
            <th className="text-left px-4 py-3 font-medium">Joined</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {users.map((user, i) => (
            <tr key={user.id} className={cn('border-b last:border-0', i % 2 === 0 ? '' : 'bg-muted/20')}>
              <td className="px-4 py-3">
                <div className="font-medium truncate max-w-[200px]">{user.email}</div>
                {user.name && <div className="text-xs text-muted-foreground">{user.name}</div>}
              </td>
              <td className="px-4 py-3">
                <Badge className={cn('text-xs', planColors[user.plan] ?? '')}>{user.plan}</Badge>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {user.auditsUsed} / {user.auditsLimit}
              </td>
              <td className="px-4 py-3 text-muted-foreground text-xs">
                {new Date(user.createdAt).toLocaleDateString()}
              </td>
              <td className="px-4 py-3">
                <select
                  disabled={updating === user.id}
                  defaultValue=""
                  onChange={(e) => { if (e.target.value) changePlan(user.id, e.target.value) }}
                  className="text-xs border rounded px-2 py-1 bg-background"
                >
                  <option value="" disabled>Change plan…</option>
                  {['FREE', 'BUILDER', 'TEAM', 'STUDIO'].map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
