'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { AdminActionButton } from './AdminActionButton'
export function SupportComposer({ sessionId, onSent }: { sessionId: string; onSent: () => void }) {
  const [body, setBody] = useState(''),
    [status, setStatus] = useState('Loading draft…'),
    [ready, setReady] = useState(false)
  const current = useRef({
    body: '',
    saved: '',
    revision: 0,
    ready: false,
    busy: false,
    conflict: false,
  })
  const flush = useCallback(async () => {
    const state = current.current
    if (!state.ready || state.busy || state.conflict || state.body === state.saved) return
    state.busy = true
    setStatus('Saving draft…')
    const sent = state.body
    try {
      const response = await fetch(`/api/admin/support/sessions/${sessionId}/draft`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: sent, revision: state.revision }),
      })
      if (!response.ok) {
        state.conflict = response.status === 409
        throw new Error(
          response.status === 409
            ? 'Draft changed in another window. Reload before editing.'
            : 'Draft could not be saved. Your text remains here.',
        )
      }
      const data = await response.json()
      state.revision = data.revision
      state.saved = sent
      setStatus('Draft saved')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Draft could not be saved.')
    } finally {
      state.busy = false
    }
  }, [sessionId])
  useEffect(() => {
    let live = true
    fetch(`/api/admin/support/sessions/${sessionId}/draft`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load draft. Reload this conversation.')
        return response.json()
      })
      .then((data) => {
        if (!live) return
        current.current = {
          body: data.body,
          saved: data.body,
          revision: data.revision,
          ready: true,
          busy: false,
          conflict: false,
        }
        setBody(data.body)
        setReady(true)
        setStatus('Draft saved')
      })
      .catch((err) => {
        if (live) setStatus(err.message)
      })
    const timer = setInterval(() => void flush(), 750)
    return () => {
      live = false
      clearInterval(timer)
      void flush()
    }
  }, [sessionId, flush])
  return (
    <div className="space-y-3 p-4">
      <label htmlFor={`reply-${sessionId}`} className="text-sm font-medium">
        Reply as FixFlags team
      </label>
      <Textarea
        id={`reply-${sessionId}`}
        maxLength={4000}
        disabled={!ready}
        value={body}
        onChange={(e) => {
          current.current.body = e.target.value
          setBody(e.target.value)
          setStatus('Draft has unsaved changes')
        }}
      />
      <p role="status" className="text-xs text-muted-foreground">
        {status}
      </p>
      {ready && body.trim() && (
        <AdminActionButton
          action="SUPPORT_REPLY"
          targetId={sessionId}
          input={{ body: body.trim() }}
          onCompleted={async () => {
            const submitted = body.trim()
            if (current.current.body.trim() === submitted) {
              try {
                const response = await fetch(`/api/admin/support/sessions/${sessionId}/draft`)
                if (!response.ok) throw new Error('Could not refresh draft')
                const next = await response.json()
                current.current = {
                  ...current.current,
                  body: next.body,
                  saved: next.body,
                  revision: next.revision,
                  conflict: false,
                }
                setBody(next.body)
                setStatus('Draft saved')
              } catch {
                setStatus('Reply sent. Reload the conversation to refresh the draft.')
              }
            }
            onSent()
          }}
        />
      )}
    </div>
  )
}
