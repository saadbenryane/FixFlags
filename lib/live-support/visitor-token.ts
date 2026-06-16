import { cookies } from 'next/headers'
import { SUPPORT_VISITOR_COOKIE } from '@/lib/live-support/types'

function generateVisitorToken(): string {
  return `v_${crypto.randomUUID().replace(/-/g, '')}`
}

export async function getOrCreateVisitorToken(): Promise<string> {
  const cookieStore = await cookies()
  const existing = cookieStore.get(SUPPORT_VISITOR_COOKIE)?.value
  if (existing) return existing

  const token = generateVisitorToken()
  cookieStore.set(SUPPORT_VISITOR_COOKIE, token, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  })
  return token
}

export async function readVisitorToken(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(SUPPORT_VISITOR_COOKIE)?.value ?? null
}
