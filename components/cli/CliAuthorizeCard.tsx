'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Terminal } from 'lucide-react'
import { Button } from '@/components/ui/button'

type AuthorizationState =
  | 'loading'
  | 'ready'
  | 'approved'
  | 'denied'
  | 'expired'
  | 'unavailable'

export function CliAuthorizeCard({ userCode }: { userCode: string }) {
  const [state, setState] = useState<AuthorizationState>('loading')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!userCode) {
      setState('unavailable')
      setError('Open this page from the link printed by fixflags login.')
      return
    }
    const controller = new AbortController()
    void fetch(
      `/api/cli/auth/authorize?user_code=${encodeURIComponent(userCode)}`,
      { signal: controller.signal }
    )
      .then(async (response) => {
        const body = (await response.json()) as {
          status?: string
          canAuthorize?: boolean
          message?: string
        }
        if (!response.ok) throw new Error(body.message || 'Authorization request not found.')
        if (!body.canAuthorize) {
          setState('unavailable')
          setError('CLI access requires a Pro or Studio plan.')
          return
        }
        if (body.status !== 'PENDING') {
          setState(body.status === 'APPROVED' ? 'approved' : 'expired')
          return
        }
        setState('ready')
      })
      .catch((reason: unknown) => {
        if ((reason as Error).name === 'AbortError') return
        setState('unavailable')
        setError((reason as Error).message)
      })
    return () => controller.abort()
  }, [userCode])

  async function decide(decision: 'approve' | 'deny') {
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/cli/auth/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userCode, decision }),
      })
      const body = (await response.json()) as { message?: string }
      if (!response.ok) throw new Error(body.message || 'Authorization failed.')
      setState(decision === 'approve' ? 'approved' : 'denied')
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  const finished = state === 'approved' || state === 'denied'
  return (
    <section className="w-full rounded-[var(--radius-card)] border border-border bg-card p-6 shadow-sm sm:p-8">
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
        {finished ? <CheckCircle2 aria-hidden /> : <Terminal aria-hidden />}
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">
        {state === 'approved'
          ? 'CLI connected'
          : state === 'denied'
            ? 'Connection denied'
            : 'Connect FixFlags CLI'}
      </h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {finished
          ? 'You can close this page and return to your terminal.'
          : 'Only approve if this code matches the one shown in your terminal.'}
      </p>

      {!finished ? (
        <div className="my-6 rounded-[var(--radius-control)] border border-border bg-muted/40 px-4 py-5 text-center font-mono text-2xl font-semibold tracking-[0.18em]">
          {userCode || 'NO CODE'}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {state === 'ready' ? (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button
            variant="brand"
            className="flex-1"
            disabled={submitting}
            onClick={() => void decide('approve')}
          >
            Approve connection
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            disabled={submitting}
            onClick={() => void decide('deny')}
          >
            Deny
          </Button>
        </div>
      ) : null}
      {state === 'loading' ? (
        <p className="mt-6 text-sm text-muted-foreground" aria-live="polite">
          Checking authorization request
        </p>
      ) : null}
    </section>
  )
}
