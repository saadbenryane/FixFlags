'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardTitle } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { parseApiErrorResponse } from '@/lib/api/parse-error'
import { SHARE_COPY } from '@/lib/marketing/copy'

export function ShareLinkPageClient({
  token,
  requiresPassword,
}: {
  token: string
  requiresPassword: boolean
}) {
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(!requiresPassword)
  const [error, setError] = useState<string | null>(null)

  const authorize = useCallback(async (enteredPassword: string) => {
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/share/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: enteredPassword }),
      })
      if (!response.ok) throw new Error((await parseApiErrorResponse(response)).message)
      const data = await response.json() as { url: string }
      window.location.assign(data.url)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : SHARE_COPY.access.openFailed)
    } finally {
      setPending(false)
    }
  }, [token])

  useEffect(() => {
    if (!requiresPassword) window.location.assign(`/api/share/${token}`)
  }, [requiresPassword, token])

  if (!requiresPassword) {
    return (
      <Container className="flex min-h-[60vh] items-center justify-center py-12" aria-live="polite">
        <Card className="w-full max-w-sm space-y-4 p-6 text-center">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-brand" aria-hidden />
          <CardTitle>{SHARE_COPY.access.openingTitle}</CardTitle>
          <p className="text-sm text-muted-foreground">{SHARE_COPY.access.openingBody}</p>
          {error ? (
            <div className="space-y-3" role="alert">
              <p className="text-sm text-destructive">{error}</p>
              <Button onClick={() => window.location.assign(`/api/share/${token}`)} className="min-h-11">{SHARE_COPY.access.retry}</Button>
            </div>
          ) : null}
        </Card>
      </Container>
    )
  }

  return (
    <Container className="flex min-h-[60vh] items-center justify-center py-12">
      <Card className="w-full max-w-sm space-y-4 p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Lock className="h-6 w-6 text-muted-foreground" aria-hidden />
        </div>
        <CardTitle>{SHARE_COPY.access.passwordTitle}</CardTitle>
        <p className="text-sm text-muted-foreground">{SHARE_COPY.access.passwordBody}</p>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void authorize(password)
          }}
          className="space-y-3"
        >
          <Input
            type="password"
            autoComplete="current-password"
            aria-label={SHARE_COPY.access.passwordLabel}
            placeholder={SHARE_COPY.access.passwordPlaceholder}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'share-password-error' : undefined}
          />
          {error ? <p id="share-password-error" className="text-sm text-destructive" role="alert">{error}</p> : null}
          <Button type="submit" className="min-h-11 w-full" disabled={pending || !password}>
            {pending ? SHARE_COPY.access.checking : SHARE_COPY.access.viewReport}
          </Button>
        </form>
      </Card>
    </Container>
  )
}
