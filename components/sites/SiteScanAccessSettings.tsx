'use client'

import { InteractiveTextarea } from '@/components/ui/interactive-controls'
import { useCallback, useEffect, useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SITE_SETTINGS_COPY } from '@/lib/marketing/copy/site-settings'
import { parseScanAccessInput, scanAccessInputSchema } from '@/lib/audit/scan-access-input'
import { executeSiteAction, SiteActionError, type siteActionSchemas } from '@/lib/sites/client-actions'
import { useSiteAction } from '@/hooks/useSiteAction'
import type { z } from 'zod'
import { SiteActionFeedback } from './SiteActionFeedback'
import { SiteSettingsSection } from './SiteSettingsSection'
import styles from './SiteSettingsPanels.module.css'

type Access = z.infer<typeof siteActionSchemas.scanAccess>
type AccessField = 'username' | 'password' | 'headers' | 'cookies' | 'note'
export function SiteScanAccessSettings({ siteId }: { siteId: string }) {
  const C = SITE_SETTINGS_COPY.access
  const id = useId(), router = useRouter()
  const [saved, setSaved] = useState<Access | null>(null)
  const [loading, setLoading] = useState(true), [loadFailed, setLoadFailed] = useState(false)
  const [unreadable, setUnreadable] = useState(false)
  const [username, setUsername] = useState(''), [password, setPassword] = useState(''), [note, setNote] = useState('')
  const [headers, setHeaders] = useState(''), [cookies, setCookies] = useState('')
  const [validation, setValidation] = useState<{ field: AccessField; message: string } | null>(null)
  const { busy, message, error, submit, clearFeedback } = useSiteAction(`site:${siteId}:access`)
  const endpoint = `/api/sites/${siteId}/scan-access`
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setLoadFailed(false); setUnreadable(false)
    try {
      const value = await executeSiteAction(endpoint, { method: 'GET', cache: 'no-store', signal }, 'scanAccess')
      if (!signal?.aborted) setSaved(value)
    } catch (error) { if (!signal?.aborted) { setLoadFailed(true); setUnreadable(error instanceof SiteActionError && error.code === 'ACCESS_UNREADABLE') } }
    finally { if (!signal?.aborted) setLoading(false) }
  }, [endpoint])
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort() }, [load])
  function invalid(field: AccessField, message: string) {
    setValidation({ field, message })
    const input = document.getElementById(`${id}-${field}`)
    const disclosure = input?.closest('details')
    if (disclosure) disclosure.open = true
    input?.focus()
  }
  function change(field: AccessField, value: string, update: (value: string) => void) {
    update(value)
    setValidation(current => current?.field === field ? null : current)
  }
  function fieldValidation(field: AccessField) {
    return { 'aria-invalid': validation?.field === field || undefined,
      'aria-describedby': validation?.field === field ? `${id}-validation` : undefined }
  }
  async function save() {
    if (busy || loading || loadFailed && !unreadable) return
    clearFeedback()
    setValidation(null)
    if (password && !username) return invalid('username', C.usernameRequired)
    let customHeaders: unknown, customCookies: unknown
    try { customHeaders = headers.trim() ? JSON.parse(headers) : undefined }
    catch { return invalid('headers', C.invalidHeaders) }
    try { customCookies = cookies.trim() ? JSON.parse(cookies) : undefined }
    catch { return invalid('cookies', C.invalidCookies) }
    const input = { ...(username ? { httpBasic: { username, password } } : {}),
      headers: customHeaders, cookies: customCookies, label: note || undefined }
    const parsed = scanAccessInputSchema.safeParse(input)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      if (issue.path[0] === 'headers') return invalid('headers', C.invalidHeaders)
      if (issue.path[0] === 'cookies') return invalid('cookies', C.invalidCookies)
      if (issue.path[0] === 'label') return invalid('note', C.invalidNote)
      return invalid(issue.path[1] === 'password' ? 'password' : 'username', C.invalidBasic)
    }
    const config = parseScanAccessInput(parsed.data)
    if (!config) return invalid(headers.trim() ? 'headers' : cookies.trim() ? 'cookies' : 'username', C.credentialsRequired)
    await submit(() => executeSiteAction(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scanAccess: config }) }, 'scanAccess'),
      value => { setSaved(value); setLoadFailed(false); setUnreadable(false); setUsername(''); setPassword(''); setHeaders(''); setCookies(''); setNote(''); return C.saved }, () => router.refresh())
  }
  async function remove() {
    setValidation(null)
    await submit(() => executeSiteAction(endpoint, { method: 'DELETE' }, 'scanAccess'), value => { setSaved(value); setLoadFailed(false); setUnreadable(false); return C.removed }, () => router.refresh())
  }
  return <SiteSettingsSection id="scan-access" tabIndex={-1}>
    <div className={styles.heading}><span className={styles.icon}><KeyRound size={17} aria-hidden /></span><div><h2>{C.title}</h2><p>{C.body}</p></div></div>
    {loading ? <p role="status" className={styles.note}>{SITE_SETTINGS_COPY.access.loading}</p> : loadFailed ? <div className={styles.actions}><p role="alert">{unreadable ? C.unreadable : C.unavailable}</p><Button variant="outline" onClick={() => void load()}>{C.retry}</Button></div>
      : <p className={styles.note}>{saved?.configured ? C.configured : C.public}{saved?.summary?.label ? ` ${saved.summary.label}` : ''}</p>}
    <form onSubmit={event => { event.preventDefault(); void save() }} className="mt-4 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm" htmlFor={`${id}-username`}><span>{C.username}</span><Input id={`${id}-username`} {...fieldValidation('username')} value={username} onChange={event => change('username', event.target.value, setUsername)} autoComplete="off" maxLength={200} disabled={busy} /></label>
        <label className="space-y-2 text-sm" htmlFor={`${id}-password`}><span>{C.password}</span><Input id={`${id}-password`} {...fieldValidation('password')} type="password" value={password} onChange={event => change('password', event.target.value, setPassword)} autoComplete="new-password" maxLength={500} disabled={busy} /></label>
      </div>
      <details className="text-sm"><summary className="flex min-h-11 cursor-pointer items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{C.advanced}</summary>
        <div className="mt-3 space-y-4">{([{ key: 'headers', label: C.headers, value: headers, change: setHeaders }, { key: 'cookies', label: C.cookies, value: cookies, change: setCookies }] as const).map(field => <label key={field.key} className="block space-y-2" htmlFor={`${id}-${field.key}`}><span>{field.label}</span><InteractiveTextarea id={`${id}-${field.key}`} {...fieldValidation(field.key)} value={field.value} onChange={event => change(field.key, event.target.value, field.change)} maxLength={100_000} rows={4} disabled={busy} spellCheck={false} className="min-h-11 w-full rounded-control border border-border bg-background p-3 font-mono text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" /></label>)}</div>
      </details>
      <label className="block space-y-2 text-sm" htmlFor={`${id}-note`}><span>{C.note}</span><Input id={`${id}-note`} {...fieldValidation('note')} value={note} onChange={event => change('note', event.target.value, setNote)} maxLength={200} disabled={busy} /></label>
      {validation ? <p id={`${id}-validation`} role="alert" className="text-sm text-destructive">{validation.message}</p> : null}
      <p className="text-sm text-muted-foreground">{C.replacement}</p>
      <div className="flex flex-wrap gap-2"><Button type="submit" loading={busy} disabled={loading || loadFailed && !unreadable || !username && !password && !headers.trim() && !cookies.trim()}>{C.save}</Button>
        {saved?.configured || unreadable ? <Button variant="outline" type="button" disabled={busy || loading || loadFailed && !unreadable} onClick={() => void remove()}>{C.remove}</Button> : null}</div>
    </form>
    <SiteActionFeedback siteId={siteId} message={message} error={error} />
  </SiteSettingsSection>
}
