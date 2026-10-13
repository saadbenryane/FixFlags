'use client'
import { useState } from 'react'
import { AdminActionButton } from './AdminActionButton'
export function SiteControls({
  id,
  interval,
  everyMinutes,
  notificationLevel,
  recovery,
  accountsEnabled,
  remainingAccounts,
}: {
  id: string
  interval: string | null
  everyMinutes: number | null
  notificationLevel: string
  recovery: boolean
  accountsEnabled: boolean
  remainingAccounts: number
}) {
  const [cadence, setCadence] = useState(interval?.toLowerCase() ?? 'off'),
    [minutes, setMinutes] = useState(everyMinutes ?? 60),
    [notifications, setNotifications] = useState(notificationLevel),
    [notifyRecovery, setNotifyRecovery] = useState(recovery),
    [accounts, setAccounts] = useState(accountsEnabled)
  const field = 'h-11 w-full rounded-input border bg-background px-3 text-sm'
  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Monitoring</h2>
        <div className="grid items-end gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-sm">
            Schedule
            <select className={field} value={cadence} onChange={(e) => setCadence(e.target.value)}>
              {['off', 'weekly', 'daily', 'hourly', 'custom'].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          {cadence === 'custom' && (
            <label className="space-y-1 text-sm">
              Every minutes
              <input
                type="number"
                min={5}
                max={10080}
                className={field}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
              />
            </label>
          )}
          <AdminActionButton
            action="SITE_SET_MONITORING"
            targetId={id}
            input={{
              interval: cadence === 'off' ? null : cadence,
              ...(cadence === 'custom' ? { everyMinutes: minutes } : {}),
            }}
          />
        </div>
      </section>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Notifications and test accounts</h2>
        <label className="block space-y-1 text-sm">
          Notification level
          <select
            className={field}
            value={notifications}
            onChange={(e) => setNotifications(e.target.value)}
          >
            <option value="FLAGS">Flags</option>
            <option value="CRITICAL_ONLY">Critical only</option>
            <option value="OFF">Off</option>
          </select>
        </label>
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={notifyRecovery}
            onChange={(e) => setNotifyRecovery(e.target.checked)}
          />
          Notify on recovery
        </label>
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={accounts}
            onChange={(e) => setAccounts(e.target.checked)}
          />
          Enable test account checks
        </label>
        <AdminActionButton
          action="SITE_SET_SETTINGS"
          targetId={id}
          input={{
            notificationLevel: notifications,
            notifyOnRecovery: notifyRecovery,
            accountChecksEnabled: accounts,
          }}
        />
      </section>
      <div className="flex flex-wrap gap-3">
        <AdminActionButton action="SITE_CHECK" targetId={id} />
        <AdminActionButton action="SITE_RECONCILE" targetId={id} />
        <AdminActionButton action="SITE_ACCOUNT_RECONCILE" targetId={id} />
        <AdminActionButton action="SITE_ACCOUNT_CLEANUP" targetId={id} />
        {remainingAccounts === 0 && <AdminActionButton action="SITE_REMOVE" targetId={id} />}
      </div>
      {remainingAccounts > 0 && (
        <p className="text-sm text-muted-foreground">
          Complete test account cleanup before removing this Site.
        </p>
      )}
    </div>
  )
}
