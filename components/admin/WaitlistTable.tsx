import Link from 'next/link'
import type { WaitlistRow } from '@/lib/billing/waitlist-segments'
import { AdminActionButton } from './AdminActionButton'
import { adminDate } from '@/lib/admin/format'
export function WaitlistTable({ rows }: { rows: WaitlistRow[] }) {
  return (
    <div className="space-y-4">
      {!rows.length && (
        <p className="text-sm text-muted-foreground">No waitlist entries in this view.</p>
      )}
      {rows.map((row) => (
        <section key={row.id} className="space-y-3 rounded-card bg-muted/30 p-5">
          <div className="flex flex-wrap justify-between gap-3">
            <Link href={`/admin/users/${row.userId}`} className="font-medium underline break-all">
              {row.email}
            </Link>
            <span className="text-sm">
              {row.plan === 'TEAM' ? 'Studio' : 'Pro'} ·{' '}
              {row.batch ? `Batch ${row.batch}` : 'No batch'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Joined {adminDate(row.joinedAt)} ·{' '}
            {row.accessGrantedAt ? 'Access granted' : 'Access pending'}
          </p>
          <div className="flex flex-wrap gap-2">
            <AdminActionButton
              action="WAITLIST_BATCH"
              targetId={row.id}
              input={{ batch: 1 }}
              label="Assign batch 1"
            />
            <AdminActionButton
              action="WAITLIST_BATCH"
              targetId={row.id}
              input={{ batch: 2 }}
              label="Assign batch 2"
            />
            <AdminActionButton action="WAITLIST_INVITE" targetId={row.id} />
            {!row.accessGrantedAt && (
              <AdminActionButton action="WAITLIST_GRANT" targetId={row.id} />
            )}
          </div>
        </section>
      ))}
    </div>
  )
}
