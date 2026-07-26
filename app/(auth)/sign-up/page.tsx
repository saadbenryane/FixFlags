'use client'

import { Suspense } from 'react'
import { AuthFlow } from '@/components/auth/AuthFlow'
import { AuthCardSkeleton } from '@/components/auth/AuthCardSkeleton'

export default function SignUpPage() {
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <AuthFlow mode="signup" />
    </Suspense>
  )
}
