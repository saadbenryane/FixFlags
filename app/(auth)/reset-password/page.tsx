'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
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
      setConfirmError('Passwords do not match')
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
            <Link href="/forgot-password" className="text-primary transition-colors duration-200 hover:text-primary/80">
              {AUTH.resetPassword.requestNewLink}
            </Link>
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
          label="New password"
          value={password}
          onChange={setPassword}
          showRequirements
        />
        <PasswordInput
          label="Confirm password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          error={confirmError}
        />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
