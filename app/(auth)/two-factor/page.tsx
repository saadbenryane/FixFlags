'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Fingerprint } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { FormContainer } from '@/components/ui/form-field'
import { authClient } from '@/lib/auth-client'
import { AUTH } from '@/lib/marketing/copy-barrel'
import { AuthCard } from '@/components/auth/AuthCard'
import { AuthCardSkeleton } from '@/components/auth/AuthCardSkeleton'
import { useAuthRedirect } from '@/hooks/useAuthRedirect'
import { trackEvent } from '@/lib/analytics/events'
import { passkeySessionReceipt, tokenSessionReceipt } from '@/lib/auth/client-session-receipt'
import { requestAccountChange } from '@/lib/auth/client-account-request'

function TwoFactorRoute() {
  const route = useAuthRedirect()
  return <TwoFactorForm key={route.postLoginHref} postLoginHref={route.postLoginHref} signInHref={route.signInHref} />
}

function TwoFactorForm({ postLoginHref, signInHref }: Pick<ReturnType<typeof useAuthRedirect>, 'postLoginHref' | 'signInHref'>) {
  const router = useRouter()
  const [loading, setLoading] = useState<'passkey' | 'backup' | null>(null)
  const [backupCode, setBackupCode] = useState('')
  const [trustDevice, setTrustDevice] = useState(true)
  const [hydrated, setHydrated] = useState(false)
  const [error, setError] = useState('')
  const submitting = useRef(false)
  const requestOwner = useRef<AbortController | null>(null)
  useEffect(() => {
    const owner = new AbortController()
    requestOwner.current = owner
    setHydrated(true)
    return () => { owner.abort(); if (requestOwner.current === owner) requestOwner.current = null }
  }, [])

  function current(owner: AbortController) { return requestOwner.current === owner && !owner.signal.aborted }
  async function submit(kind: 'passkey' | 'backup', operation: (owner: AbortController) => Promise<void>) {
    const owner = requestOwner.current
    if (!owner || !current(owner) || submitting.current) return
    submitting.current = true
    setLoading(kind); setError('')
    try { await operation(owner) }
    catch { if (current(owner)) setError(kind === 'passkey' ? AUTH.passkeyErrors.twoFactorCancelled : AUTH.twoFactor.backupCodeError) }
    finally { if (current(owner)) { submitting.current = false; setLoading(null) } }
  }

  async function verifyPasskey() {
    await submit('passkey', async owner => {
      // The native passkey ceremony retains its browser-controlled timing.
      const { data, error } = await authClient.signIn.passkey()
      if (!current(owner)) return
      if (error) {
        const msg = error.message ?? ''
        if (/cancel|notallowed/i.test(msg)) {
          return
        }
        if (/not.?found|no.?credential/i.test(msg)) {
          setError(AUTH.passkeyErrors.twoFactorNotFound)
        } else {
          setError(AUTH.passkeyErrors.twoFactorCancelled)
        }
        return
      }
      if (!passkeySessionReceipt.safeParse(data).success) { setError(AUTH.passkeyErrors.twoFactorCancelled); return }
      trackEvent('signed_in', { method: 'passkey_2fa' })
      router.replace(postLoginHref)
    })
  }

  async function verifyBackup(event: React.FormEvent) {
    event.preventDefault()
    if (submitting.current) return
    if (!backupCode.trim()) { setError(AUTH.twoFactor.invalidBackupCode); return }
    await submit('backup', async owner => {
      const result = await requestAccountChange(signal => authClient.twoFactor.verifyBackupCode({
        code: backupCode.trim(),
        trustDevice,
        fetchOptions: { signal },
      }), tokenSessionReceipt, AUTH.twoFactor.backupCodeError, owner.signal)
      if (!current(owner)) return
      if (!result.ok) {
        setError(result.error)
        return
      }
      trackEvent('signed_in', { method: 'backup_code' })
      // Same post-login claim path as email/OAuth.
      router.replace(postLoginHref)
    })
  }

  // A visible server-rendered button must not accept a click before its
  // authentication handler is attached.
  if (!hydrated) return <AuthCardSkeleton />
  return (
    <AuthCard
      title={AUTH.twoFactor.title}
      subtitle={AUTH.twoFactor.subtitle}
      footer={
        <p className="text-center text-sm text-muted-foreground">
          <Link href={signInHref()} className="underline hover:text-foreground">
            {AUTH.twoFactor.backToSignIn}
          </Link>
        </p>
      }
    >
      <div className="space-y-5">
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <Button
          type="button"
          className="w-full"
          disabled={loading !== null}
          loading={loading === 'passkey'}
          loadingLabel={AUTH.twoFactor.passkeyCta}
          onClick={() => void verifyPasskey()}
        >
          {loading !== 'passkey' && (
            <Fingerprint className="mr-2 h-4 w-4" />
          )}
          {AUTH.twoFactor.passkeyCta}
        </Button>

        <p className="py-1 text-center text-xs uppercase text-muted-foreground">{AUTH.twoFactor.backupLabel}</p>

        <FormContainer onSubmit={verifyBackup} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="backup-code" className="text-sm font-medium">
              {AUTH.twoFactor.backupPlaceholder}
            </label>
            <Input
              id="backup-code"
              value={backupCode}
              onChange={(event) => { setBackupCode(event.target.value); setError('') }}
              autoComplete="one-time-code"
              placeholder={AUTH.twoFactor.backupPlaceholder}
              required
              disabled={loading !== null}
            />
          </div>
          <label htmlFor="trust-device" className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              id="trust-device"
              checked={trustDevice}
              disabled={loading !== null}
              onCheckedChange={(checked) => setTrustDevice(checked === true)}
            />
            {AUTH.twoFactor.trustDevice}
          </label>
          <Button
            type="submit"
            variant="outline"
            className="w-full"
            disabled={loading !== null}
            loading={loading === 'backup'}
            loadingLabel={AUTH.twoFactor.backupCta}
          >
            {AUTH.twoFactor.backupCta}
          </Button>
        </FormContainer>
      </div>
    </AuthCard>
  )
}

export default function TwoFactorPage() {
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <TwoFactorRoute />
    </Suspense>
  )
}
