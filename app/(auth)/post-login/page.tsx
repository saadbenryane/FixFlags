'use client'

import { Suspense, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { useAuthRedirect } from '@/hooks/useAuthRedirect'
import { useMe } from '@/hooks/useMe'

function PostLoginRedirect() {
  const { navigateAfterAuth } = useAuthRedirect()
  const { isLoading } = useMe({ claim: true, showClaimToast: true })

  useEffect(() => {
    if (!isLoading) {
      void navigateAfterAuth()
    }
  }, [isLoading, navigateAfterAuth])

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Signing you in...</p>
    </div>
  )
}

export default function PostLoginPage() {
  return (
    <Suspense>
      <PostLoginRedirect />
    </Suspense>
  )
}
