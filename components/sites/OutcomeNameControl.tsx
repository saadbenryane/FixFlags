'use client'

import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSiteAction } from '@/hooks/useSiteAction'
import { executeSiteAction, SiteActionError } from '@/lib/sites/client-actions'
import { OUTCOME_CONFIRMATION as C } from '@/lib/marketing/copy/errors'
import { SiteActionFeedback } from './SiteActionFeedback'

type Props = { siteId: string; outcomeId: string; name: string; onRefresh?: () => Promise<unknown> }

export function OutcomeNameControl(props: Props) {
  return <OutcomeNameForm key={JSON.stringify([props.siteId, props.outcomeId])} {...props} />
}

function OutcomeNameForm({ siteId, outcomeId, name, onRefresh }: Props) {
  const router = useRouter()
  const id = useId()
  const { busy, message, error, submit, clearFeedback } = useSiteAction()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const [accepted, setAccepted] = useState({ sourceName: name, name })
  // A saved command can precede its refreshed page. A changed source retires
  // that receipt, so returning to an earlier label cannot resurrect it.
  if (accepted.sourceName !== name) setAccepted({ sourceName: name, name })
  const currentName = accepted.sourceName === name ? accepted.name : name
  const form = useRef<HTMLFormElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const edit = useRef<HTMLButtonElement>(null)
  const restoreFocus = useRef(false)
  useLayoutEffect(() => {
    if (editing) { input.current?.focus(); input.current?.select() }
  }, [editing])
  useLayoutEffect(() => {
    if (busy || !restoreFocus.current) return
    restoreFocus.current = false
    if (document.activeElement === document.body) (editing ? input.current : edit.current)?.focus()
  }, [busy, editing])

  function cancel() {
    restoreFocus.current = Boolean(form.current?.contains(document.activeElement))
    clearFeedback()
    setEditing(false)
  }
  function cancelOnEscape(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape' && !busy) { event.preventDefault(); event.stopPropagation(); cancel() }
  }
  async function save() {
    const nextName = draft.trim()
    if (!nextName || nextName === currentName || busy) return
    restoreFocus.current = Boolean(form.current?.contains(document.activeElement))
    await submit(async signal => {
      const body = await executeSiteAction(`/api/sites/${encodeURIComponent(siteId)}/outcomes`, {
        signal, method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rename', outcomeId, name: nextName }),
      }, 'outcome')
      if (body.outcome.id !== outcomeId || body.outcome.name !== nextName) throw new SiteActionError(C.saveFailed)
      return body
    }, body => { setAccepted({ sourceName: name, name: body.outcome.name }); setEditing(false); return C.renamed }, onRefresh ?? (() => router.refresh()))
  }

  return <div className="min-w-0 max-w-full">
    {editing ? <form ref={form} className="space-y-2" onSubmit={event => { event.preventDefault(); void save() }}>
      <label htmlFor={id} className="text-sm font-medium">{C.nameLabel}</label>
      <Input ref={input} id={id} value={draft} maxLength={120} required disabled={busy} onKeyDown={cancelOnEscape} onChange={event => setDraft(event.target.value)} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" loading={busy} disabled={busy || !draft.trim() || draft.trim() === currentName} onKeyDown={cancelOnEscape}>{C.save}</Button>
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={cancel} onKeyDown={cancelOnEscape}>{C.cancel}</Button>
      </div>
    </form> : <Button ref={edit} type="button" size="sm" variant="ghost" disabled={busy} onClick={() => { clearFeedback(); setDraft(currentName); setEditing(true) }}>{C.edit}</Button>}
    <SiteActionFeedback message={message} error={error} siteId={siteId} />
  </div>
}
