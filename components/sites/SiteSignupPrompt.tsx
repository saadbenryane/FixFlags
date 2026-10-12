'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/brand/Logo'
import { OAuthButtons } from '@/components/auth/OAuthButtons'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useMe } from '@/hooks/useMe'
import { useOAuthProviders } from '@/hooks/useOAuthProviders'
import { buildPostLoginQuery } from '@/hooks/useAuthRedirect'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { AUTH } from '@/lib/marketing/copy/auth'

function SignupOptions({ siteId }: { siteId: string }) {
  const oauth = useOAuthProviders()
  const next = `/sites/${siteId}`
  const copy = SITE_ACTION_COPY.signupPrompt
  return <div className="space-y-3">
    {oauth.isLoading ? <p role="status" className="text-sm text-muted-foreground">{AUTH.reportGate.preparingOptions}</p> : <OAuthButtons
      callbackURL={buildPostLoginQuery(next, null, 'report')}
      newUserCallbackURL={buildPostLoginQuery(next, null, 'report', { newUser: true })}
      google={oauth.google} github={oauth.github} from="report" hideDivider
    />}
    {oauth.error ? <Button variant="outline" className="w-full" onClick={oauth.retry}>{AUTH.oauth.discoveryRetry}</Button> : null}
    <Button asChild variant={oauth.anyEnabled ? 'outline' : 'brand'} className="w-full"><Link href={`/sign-up?next=${encodeURIComponent(next)}`}>{copy.email}</Link></Button>
    <Link className="flex min-h-11 items-center justify-center text-sm underline underline-offset-4" href={`/sign-in?next=${encodeURIComponent(next)}`}>{copy.signIn}</Link>
  </div>
}

export function SiteSignupPrompt({ siteId, auditId, checking, paused = false }: { siteId: string; auditId: string | null; checking: boolean; paused?: boolean }) {
  const { user, isLoading, error } = useMe()
  const [ready, setReady] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const storageKey = `site-signup:${auditId ?? siteId}`
  useEffect(() => {
    if (user || isLoading || error || !checking) return
    try { if (sessionStorage.getItem(storageKey)) { setDismissed(true); return } } catch { /* Storage can be unavailable. */ }
    const timer = setTimeout(() => setReady(true), 5_000)
    return () => clearTimeout(timer)
  }, [checking, user, isLoading, error, storageKey])
  function dismiss() {
    setDismissed(true)
    try { sessionStorage.setItem(storageKey, 'dismissed') } catch { /* Keep dismissal for this mount. */ }
  }
  const open = ready && !dismissed && !user && !isLoading && !error && !paused
  const copy = SITE_ACTION_COPY.signupPrompt
  return <Dialog open={open} onOpenChange={value => { if (!value) dismiss() }}>
    <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-card bg-background p-6">
      <Logo variant="mark" size="sm" />
      <DialogTitle className="pr-5 text-xl">{copy.title}</DialogTitle>
      <DialogDescription className="leading-relaxed">{copy.body}</DialogDescription>
      {open ? <SignupOptions siteId={siteId} /> : null}
      <Button variant="ghost" className="w-full text-muted-foreground" onClick={dismiss}>{copy.skip}</Button>
    </DialogContent>
  </Dialog>
}
