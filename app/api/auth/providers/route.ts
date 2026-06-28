import { NextResponse } from 'next/server'
import { isGoogleOAuthConfigured, isGithubOAuthConfigured } from '@/lib/auth/env'

export const dynamic = 'force-dynamic'

/**
 * Which social sign-in providers are enabled, resolved at RUNTIME from the
 * server env. The auth pages gate their OAuth buttons on this instead of a
 * build-time NEXT_PUBLIC flag, so setting GOOGLE_CLIENT_ID/SECRET (etc.) on the
 * deployed service is enough to light up the buttons; no rebuild required.
 */
export function GET() {
  return NextResponse.json({
    google: isGoogleOAuthConfigured(),
    github: isGithubOAuthConfigured(),
  })
}
