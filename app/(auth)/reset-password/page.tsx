'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { TextLink } from '@/components/ui/text-link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { FormContainer } from '@/components/ui/form-field'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import { AUTH } from '@/lib/marketing/copy-barrel'
import { AuthCard } from '@/components/auth/AuthCard'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { accountStatusReceipt, requestAccountChange } from '@/lib/auth/client-account-request'

function ResetPasswordRoute() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const error = searchParams.get('error')
  return <ResetPasswordForm key={JSON.stringify([token, error])} token={token} error={error} />
}

function ResetPasswordForm({ token, error }: { token: string | null; error: string | null }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [confirmError, setConfirmError] = useState('')
  const [loading, setLoading] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [completed, setCompleted] = useState(false)
  const submitting = useRef(false)
  const requestOwner = useRef<AbortController | null>(null)
  useEffect(() => {
    const owner = new AbortController()
    requestOwner.current = owner
    return () => { owner.abort(); if (requestOwner.current === owner) requestOwner.current = null }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const owner = requestOwner.current
    if (!token || error || !owner || owner.signal.aborted || submitting.current) return
    const current = () => requestOwner.current === owner && !owner.signal.aborted
    setConfirmError('')
    setRequestError('')
    if (password !== confirmPassword) {
      setConfirmError(AUTH.resetPassword.mismatch)
      return
    }
    submitting.current = true
    setLoading(true)
    try {
      const result = await requestAccountChange(signal => authClient.resetPassword({
        newPassword: password,
        token,
        fetchOptions: { signal },
      }), accountStatusReceipt, AUTH.resetPassword.error, owner.signal)
      if (!current()) return
      if (!result.ok) {
        setRequestError(result.error)
        return
      }
      toast.success(AUTH.resetPassword.success)
      setCompleted(true)
      setPassword(''); setConfirmPassword('')
      // Keep a native sign-in link if client navigation is unavailable.
      try { router.push('/sign-in') } catch { /* The confirmed result remains visible. */ }
    } finally {
      if (current()) { submitting.current = false; setLoading(false) }
    }
  }

  if (error || !token) {
    return (
      <AuthCard
        title={AUTH.resetPassword.invalidTitle}
        subtitle={AUTH.resetPassword.invalidSubtitle}
        footer={
          <p className="text-center text-sm text-muted-foreground">
            <TextLink href="/forgot-password">{AUTH.resetPassword.requestNewLink}</TextLink>
          </p>
        }
      >
        <p className="text-center text-sm text-muted-foreground">{AUTH.resetPassword.invalidBody}</p>
      </AuthCard>
    )
  }

  if (completed) return <AuthCard title={AUTH.resetPassword.completedTitle}>
    <Button asChild className="w-full"><TextLink href="/sign-in">{AUTH.signIn.cta}</TextLink></Button>
  </AuthCard>

  return (
    <AuthCard title={AUTH.resetPassword.title} subtitle={AUTH.resetPassword.subtitle}>
      <FormContainer onSubmit={handleSubmit}>
        <PasswordInput
          label={AUTH.resetPassword.newPasswordLabel}
          value={password}
          disabled={loading}
          onChange={setPassword}
          showRequirements
          autoComplete="new-password"
        />
        <PasswordInput
          label={AUTH.resetPassword.confirmPasswordLabel}
          value={confirmPassword}
          disabled={loading}
          onChange={setConfirmPassword}
          error={confirmError}
          autoComplete="new-password"
        />
        {requestError ? <p role="alert" className="text-sm text-destructive">{requestError}</p> : null}
        <Button type="submit" className="w-full" loading={loading} loadingLabel={AUTH.resetPassword.cta}>
          {AUTH.resetPassword.cta}
        </Button>
      </FormContainer>
    </AuthCard>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordRoute />
    </Suspense>
  )
}
