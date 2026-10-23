'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Fingerprint } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { FormContainer } from '@/components/ui/form-field'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import { AUTH } from '@/lib/marketing/copy-barrel'
import { AuthCard } from '@/components/auth/AuthCard'
import { AuthCardSkeleton } from '@/components/auth/AuthCardSkeleton'
import { useAuthRedirect } from '@/hooks/useAuthRedirect'
import { trackEvent } from '@/lib/analytics/events'

function TwoFactorForm() {
  const { postLoginHref, signInHref } = useAuthRedirect()
  const router = useRouter()
  const [loading, setLoading] = useState<'passkey' | 'backup' | null>(null)
  const [backupCode, setBackupCode] = useState('')
  const [trustDevice, setTrustDevice] = useState(true)
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => { setHydrated(true) }, [])

  async function verifyPasskey() {
    setLoading('passkey')
    try {
      const { error } = await authClient.signIn.passkey()
      if (error) {
        const msg = error.message ?? ''
        if (/cancel|notallowed/i.test(msg)) {
          return
        }
        if (/not.?found|no.?credential/i.test(msg)) {
          toast.error(AUTH.passkeyErrors.twoFactorNotFound)
        } else {
          toast.error(AUTH.passkeyErrors.twoFactorCancelled)
        }
        return
      }
      trackEvent('signed_in', { method: 'passkey_2fa' })
      router.replace(postLoginHref)
    } catch {
      toast.error(AUTH.passkeyErrors.twoFactorCancelled)
    } finally {
      setLoading(null)
    }
  }

  async function verifyBackup(event: React.FormEvent) {
    event.preventDefault()
    setLoading('backup')
    try {
      const { error } = await authClient.twoFactor.verifyBackupCode({
        code: backupCode.trim(),
        trustDevice,
      })
      if (error) {
        toast.error(error.message || AUTH.twoFactor.invalidBackupCode)
        return
      }
      trackEvent('signed_in', { method: 'backup_code' })
      // Same post-login claim path as email/OAuth.
      router.replace(postLoginHref)
    } catch {
      toast.error(AUTH.twoFactor.backupCodeError)
    } finally {
      setLoading(null)
    }
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
              onChange={(event) => setBackupCode(event.target.value)}
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
      <TwoFactorForm />
    </Suspense>
  )
}
