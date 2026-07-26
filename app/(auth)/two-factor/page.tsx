'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Fingerprint, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormContainer } from '@/components/ui/form-field'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import { AUTH } from '@/lib/marketing/copy'
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
      router.push(postLoginHref)
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
      router.push(postLoginHref)
    } catch {
      toast.error(AUTH.twoFactor.backupCodeError)
    } finally {
      setLoading(null)
    }
  }

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
          onClick={() => void verifyPasskey()}
        >
          {loading === 'passkey' ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Fingerprint className="mr-2 h-4 w-4" />
          )}
          {AUTH.twoFactor.passkeyCta}
        </Button>

        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border/60" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">{AUTH.twoFactor.backupLabel}</span>
          </div>
        </div>

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
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={trustDevice}
              onChange={(event) => setTrustDevice(event.target.checked)}
              className="rounded border-border"
            />
            {AUTH.twoFactor.trustDevice}
          </label>
          <Button type="submit" variant="outline" className="w-full" disabled={loading !== null}>
            {loading === 'backup' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
