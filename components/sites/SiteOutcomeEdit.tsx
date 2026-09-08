'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import type { SiteOutcomeView } from '@/lib/sites/outcomes'

export function SiteOutcomeEdit({
  siteId,
  outcomes,
}: {
  siteId: string
  outcomes: SiteOutcomeView[]
}) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')

  if (outcomes.length === 0) {
    return <p className="text-sm text-muted-foreground">Still learning your Outcomes.</p>
  }

  async function save(outcomeId: string, confirmed: boolean, nextName?: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/sites/${siteId}/outcomes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcomeId, confirmed, name: nextName }),
      })
      if (!res.ok) {
        setMessage('Could not save this Outcome')
        return
      }
      setMessage('Outcome saved')
      setEditingId(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <ul className="mt-4 space-y-3">
      {outcomes.map((outcome) => (
        <li key={outcome.id}>
          <Surface variant="nested">
          {editingId === outcome.id ? (
            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault()
                void save(outcome.id, true, name)
              }}
            >
              <label className="block text-xs text-muted-foreground" htmlFor={`outcome-${outcome.id}`}>
                Outcome name
              </label>
              <input
                id={`outcome-${outcome.id}`}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <Button type="submit" size="sm" disabled={busy}>
                  Save
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{outcome.name}</p>
                <p className="text-xs text-muted-foreground">
                  {outcome.confirmedAt ? 'Confirmed' : 'Inferred'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!outcome.confirmedAt ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void save(outcome.id, true)}
                  >
                    Looks right
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingId(outcome.id)
                    setName(outcome.name)
                  }}
                >
                  Edit
                </Button>
              </div>
            </div>
          )}
          </Surface>
        </li>
      ))}
      {message ? <li className="text-sm text-muted-foreground">{message}</li> : null}
    </ul>
  )
}
