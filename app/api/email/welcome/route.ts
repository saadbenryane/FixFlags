import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { sendNurtureEmail } from '@/lib/email/send'
import { apiError } from '@/lib/api/errors'

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session?.user?.id) {
    return apiError('Sign in to send welcome email', 401, { code: 'UNAUTHORIZED', action: 'sign_in' })
  }

  const result = await sendNurtureEmail(session.user.id, 'welcome')
  return NextResponse.json(result)
}
