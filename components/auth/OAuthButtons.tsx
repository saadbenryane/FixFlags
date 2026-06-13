'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'

const hasGoogle = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === 'true'
const hasGithub = process.env.NEXT_PUBLIC_GITHUB_OAUTH_ENABLED === 'true'

interface Props {
  callbackURL: string
  disabled?: boolean
}

export function OAuthButtons({ callbackURL, disabled }: Props) {
  const [loading, setLoading] = useState<string | null>(null)

  if (!hasGoogle && !hasGithub) return null

  async function handleOAuth(provider: 'google' | 'github') {
    setLoading(provider)
    try {
      await authClient.signIn.social({
        provider,
        callbackURL,
      })
    } catch {
      toast.error('Sign in failed')
      setLoading(null)
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        {hasGoogle && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={disabled || !!loading}
            onClick={() => handleOAuth('google')}
          >
            {loading === 'google' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continue with Google
          </Button>
        )}
        {hasGithub && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={disabled || !!loading}
            onClick={() => handleOAuth('github')}
          >
            {loading === 'github' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continue with GitHub
          </Button>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">or</span>
        <Separator className="flex-1" />
      </div>
    </>
  )
}

export function hasOAuthEnabled(): boolean {
  return hasGoogle || hasGithub
}
