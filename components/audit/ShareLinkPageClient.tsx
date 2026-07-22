'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardTitle } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { parseApiErrorResponse } from '@/lib/api/parse-error'

export function ShareLinkPageClient({
  token,
  requiresPassword,
}: {
  token: string
  requiresPassword: boolean
}) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(!requiresPassword)
  const [error, setError] = useState<string | null>(null)

  const authorize = useCallback(async (method: 'GET' | 'POST', enteredPassword?: string) => {
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/share/${token}`, {
        method,
        headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
        body: method === 'POST' ? JSON.stringify({ password: enteredPassword }) : undefined,
      })
      if (!response.ok) throw new Error((await parseApiErrorResponse(response)).message)
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not open this share link.')
    } finally {
      setPending(false)
    }
  }, [router, token])

  useEffect(() => {
    if (!requiresPassword) void authorize('GET')
  }, [authorize, requiresPassword])

  if (!requiresPassword) {
    return (
      <Container className="flex min-h-[60vh] items-center justify-center py-12" aria-live="polite">
        <Card className="w-full max-w-sm space-y-4 p-6 text-center">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-brand" aria-hidden />
          <CardTitle>Opening shared report</CardTitle>
          <p className="text-sm text-muted-foreground">Checking that this link is still available.</p>
          {error ? (
            <div className="space-y-3" role="alert">
              <p className="text-sm text-destructive">{error}</p>
              <Button onClick={() => void authorize('GET')} className="min-h-11">Try again</Button>
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
        <CardTitle>Password required</CardTitle>
        <p className="text-sm text-muted-foreground">This report is protected. Enter its password to continue.</p>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void authorize('POST', password)
          }}
          className="space-y-3"
        >
          <Input
            type="password"
            autoComplete="current-password"
            aria-label="Share password"
            placeholder="Enter password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'share-password-error' : undefined}
          />
          {error ? <p id="share-password-error" className="text-sm text-destructive" role="alert">{error}</p> : null}
          <Button type="submit" className="min-h-11 w-full" disabled={pending || !password}>
            {pending ? 'Checking…' : 'View report'}
          </Button>
        </form>
      </Card>
    </Container>
  )
}
