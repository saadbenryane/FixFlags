'use client'

import { Suspense, useState } from 'react'
import { TextLink } from '@/components/ui/text-link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { FormContainer } from '@/components/ui/form-field'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import { AUTH } from '@/lib/marketing/copy'
import { AuthCard } from '@/components/auth/AuthCard'
import { PasswordInput } from '@/components/auth/PasswordInput'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const error = searchParams.get('error')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [confirmError, setConfirmError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    setConfirmError('')
    if (password !== confirmPassword) {
      setConfirmError(AUTH.resetPassword.mismatch)
      return
    }
    setLoading(true)
    try {
      const { error: resetError } = await authClient.resetPassword({
        newPassword: password,
        token,
      })
      if (resetError) {
        toast.error(resetError.message || AUTH.resetPassword.error)
        return
      }
      toast.success(AUTH.resetPassword.success)
      router.push('/sign-in')
    } catch {
      toast.error(AUTH.resetPassword.error)
    } finally {
      setLoading(false)
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

  return (
    <AuthCard title={AUTH.resetPassword.title} subtitle={AUTH.resetPassword.subtitle}>
      <FormContainer onSubmit={handleSubmit}>
        <PasswordInput
          label={AUTH.resetPassword.newPasswordLabel}
          value={password}
          onChange={setPassword}
          showRequirements
          autoComplete="new-password"
        />
        <PasswordInput
          label={AUTH.resetPassword.confirmPasswordLabel}
          value={confirmPassword}
          onChange={setConfirmPassword}
          error={confirmError}
          autoComplete="new-password"
        />
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
      <ResetPasswordForm />
    </Suspense>
  )
}
