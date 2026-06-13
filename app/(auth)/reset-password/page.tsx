'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lock, Loader2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconInput } from '@/components/ui/icon-input'
import { FormContainer } from '@/components/ui/form-field'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import { AUTH } from '@/lib/marketing/copy'
import { AuthCard } from '@/components/auth/AuthCard'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const error = searchParams.get('error')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    if (password !== confirm) {
      toast.error(AUTH.resetPassword.mismatch)
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
            <Link href="/forgot-password" className="text-primary link-underline-grow">
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
        <IconInput
          type="password"
          label="New password"
          icon={<Lock className="h-4 w-4" />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
        <IconInput
          type="password"
          label="Confirm password"
          icon={<Lock className="h-4 w-4" />}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={8}
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
