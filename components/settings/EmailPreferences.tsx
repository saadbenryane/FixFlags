'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InteractiveSelect } from '@/components/ui/interactive-controls'
import { Field } from '@/components/ui/form-field'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'
import { useSettingsDraft } from '@/hooks/useSettingsDraft'
import { AUTH } from '@/lib/marketing/copy/auth'
import type { EmailDeliveryView } from '@/lib/email/delivery-state'
import { NOTIFICATIONS_COPY as C } from '@/lib/marketing/copy/notifications'
import { notificationPreferencesSchema, type NotificationPreferences } from '@/lib/notifications/preferences'

const responseSchema = z.object({ ok: z.literal(true), notifications: notificationPreferencesSchema.extend({
  nextSendAt: z.string().datetime().nullable(),
}) })
const selectClass = 'min-h-11 w-full rounded-[var(--radius-control)] border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-50'

export function EmailPreferences({ ownerId, initial, nextSendAt, email, emailVerified, hasMonitoredSites, followCadence = null, history = [], blocked = false }: {
  ownerId: string;
  initial: NotificationPreferences; nextSendAt: string | null; email: string; emailVerified: boolean; hasMonitoredSites: boolean;
  followCadence?: 'DAILY' | 'WEEKLY' | null; history?: EmailDeliveryView[]; blocked?: boolean;
}) {
  const draft = useSettingsDraft(ownerId, 'email-preferences', initial)
  const { values, saved, dirty } = draft
  const [next, setNext] = useState(nextSendAt)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const zones = useMemo(() => typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [], [])
  const confirmDialog = useUnsavedChanges(dirty, draft.discard)
  const enabled = values.cadence !== 'OFF'
  const change = (patch: Partial<NotificationPreferences>) => { draft.change(patch); setMessage(''); setError('') }
  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!dirty || busy) return
    const snapshot = draft.snapshot()
    const submitted = { ...snapshot.values, timeZone: enabled ? snapshot.values.timeZone : saved.timeZone }
    if (!notificationPreferencesSchema.safeParse(submitted).success) { setError(C.invalid); return }
    setBusy(true); setError(''); setMessage('')
    try {
      const response = await fetch('/api/me/preferences', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifications: Object.fromEntries(Object.entries(submitted).filter(([key, value]) => value !== saved[key as keyof NotificationPreferences])) }) })
      if (!response.ok) throw new Error(C.error)
      const result = responseSchema.parse(await response.json()).notifications
      const { nextSendAt: at, ...preferences } = result
      draft.acknowledge(snapshot, preferences); setNext(at); setMessage(C.saved)
    } catch { setError(C.error) }
    finally { setBusy(false) }
  }
  return <Card variant="subtle" id="email-updates">
    {confirmDialog}
    <CardHeader><CardTitle as="h2" className="text-base">{C.title}</CardTitle><CardDescription>{C.description}</CardDescription></CardHeader>
    <CardContent className="space-y-6">
      <p className="text-sm text-muted-foreground">{C.recipient(email)}</p>
      {blocked ? <p role="alert" className="rounded-card bg-muted p-4 text-sm">{C.blocked}</p> : null}
      <form onSubmit={save} className="space-y-5">
        <Field id="summary-cadence" label={C.frequency}>{props => <InteractiveSelect {...props} className={selectClass} disabled={busy}
          value={values.cadence} onChange={event => change({ cadence: event.target.value as NotificationPreferences['cadence'] })}>
          {Object.entries(C.frequencies).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </InteractiveSelect>}</Field>
        {values.cadence === 'FOLLOW_MONITORING' ? <p className="text-sm text-muted-foreground">{C.follow}</p> : null}
        {values.cadence === 'FOLLOW_MONITORING' && followCadence ? <p className="text-sm">{followCadence === 'DAILY' ? C.followDaily : C.followWeekly}</p> : null}
        {enabled ? <div className="grid gap-5 sm:grid-cols-2">
          <Field id="summary-hour" label={C.time}>{props => <InteractiveSelect {...props} className={selectClass} disabled={busy} value={values.hour}
            onChange={event => change({ hour: Number(event.target.value) })}>
            {Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{`${String(hour).padStart(2, '0')}:00`}</option>)}
          </InteractiveSelect>}</Field>
          <div className="space-y-2"><Field id="summary-timezone" label={C.timeZone}>{props => <Input {...props} disabled={busy} list="summary-timezones" value={values.timeZone}
            onChange={event => change({ timeZone: event.target.value })} />}</Field>
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => change({ timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })}>{C.localTimeZone}</Button>
          </div>
          <datalist id="summary-timezones"><option value="UTC" />{zones.map(zone => <option key={zone} value={zone} />)}</datalist>
          {values.cadence === 'WEEKLY' || values.cadence === 'FOLLOW_MONITORING' && followCadence !== 'DAILY' ? <Field id="summary-weekday" label={C.weekday}>{props => <InteractiveSelect {...props} className={selectClass} disabled={busy} value={values.weekday}
            onChange={event => change({ weekday: Number(event.target.value) })}>
            {C.weekdays.map((label, day) => <option key={day} value={day}>{label}</option>)}
          </InteractiveSelect>}</Field> : null}
        </div> : null}
        <p className="text-sm text-muted-foreground">{enabled ? C.timing : C.off}</p>
        {!emailVerified ? <p className="text-sm text-muted-foreground">{C.verify}</p> : null}
        {!hasMonitoredSites ? <p className="text-sm text-muted-foreground">{C.empty}</p> : null}
        {!next && enabled && emailVerified && hasMonitoredSites && !blocked ? <p className="text-sm text-muted-foreground">{C.schedulePending}</p> : null}
        {next && !dirty && enabled && emailVerified && hasMonitoredSites && !blocked ? <p className="text-sm">{C.next(new Intl.DateTimeFormat('en', {
          timeZone: saved.timeZone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(next)) + ` (${saved.timeZone})`)}</p> : null}
        <div className="space-y-2 rounded-card bg-muted/50 p-4">
          <h3 className="text-sm font-medium">{C.tips}</h3><p className="text-sm text-muted-foreground">{C.tipsBody}</p>
          <label htmlFor="product-tips" className="flex cursor-pointer items-center text-sm"><Checkbox id="product-tips" disabled={busy}
            checked={values.productTips} onCheckedChange={checked => change({ productTips: checked === true })} />{C.tipsChoice}</label>
        </div>
        <div className="flex flex-wrap gap-3"><Button type="submit" disabled={!dirty || busy} loading={busy} loadingLabel={C.saving}>{C.save}</Button>
          {dirty ? <Button type="button" variant="ghost" disabled={busy} onClick={() => { draft.discard(); setMessage(''); setError('') }}>{AUTH.settings.account.discardChanges}</Button> : null}
        </div>
        <p role="status" className="text-sm" aria-live="polite">{message}</p>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      </form>
      <div className="space-y-2 rounded-card bg-muted/50 p-4">
        <h3 className="text-sm font-medium">{C.alerts}</h3><p className="text-sm text-muted-foreground">{C.alertsBody}</p>
        <Link href="/dashboard" className="text-sm text-link hover:underline">{C.manageSites}</Link>
      </div>
      <section className="space-y-3" aria-labelledby="email-history-title">
        <h3 id="email-history-title" className="text-sm font-medium">{C.history}</h3>
        {history.length ? <><ul className="space-y-3">{history.map(item => <li key={item.id} className="rounded-card bg-muted/50 p-4 text-sm">
          <p className="font-medium">{C.channels[item.channel]}</p>
          <p>{C.delivery[item.state]}</p><time className="text-xs text-muted-foreground" dateTime={item.at}>{new Intl.DateTimeFormat('en', {
            timeZone: saved.timeZone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.at))}</time>
        </li>)}</ul><p className="text-xs text-muted-foreground">{C.historyScope}</p></> : <p className="text-sm text-muted-foreground">{C.historyEmpty}</p>}
      </section>
    </CardContent>
  </Card>
}
