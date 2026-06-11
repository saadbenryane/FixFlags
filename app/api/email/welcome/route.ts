import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { sendNurtureEmail } from '@/lib/email/send'

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await sendNurtureEmail(session.user.id, 'welcome')
  return NextResponse.json(result)
}
