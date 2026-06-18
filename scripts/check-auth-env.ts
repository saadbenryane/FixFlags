import { config } from 'dotenv'

config({ path: '.env.local' })
config()

import {
  getAuthBaseUrl,
  isAnyOAuthConfigured,
  isGoogleOAuthConfigured,
  isGithubOAuthConfigured,
  oauthCallbackUrl,
  validateAuthEnv,
} from '../lib/auth/env'

console.log('FixFlags auth / SSO configuration\n')

try {
  validateAuthEnv()
  console.log('Auth env validation: OK (warnings may appear above)\n')
} catch (err) {
  console.error('Auth env validation failed:', err instanceof Error ? err.message : err)
  console.log('')
}

const base = getAuthBaseUrl()
console.log(`App URL (BETTER_AUTH_URL / NEXT_PUBLIC_APP_URL): ${base}`)
console.log(`BETTER_AUTH_SECRET: ${process.env.BETTER_AUTH_SECRET ? 'set' : 'missing'}`)
console.log('')
console.log('OAuth providers:')
console.log(`  Google: ${isGoogleOAuthConfigured() ? 'configured' : 'not configured'}`)
console.log(`  GitHub: ${isGithubOAuthConfigured() ? 'configured' : 'not configured'}`)
console.log('')

if (!isAnyOAuthConfigured()) {
  console.log('To enable SSO, set these in .env.local (local) and Railway web service (production):')
  console.log('  GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET')
  console.log('  GITHUB_CLIENT_ID + GITHUB_CLIENT_SECRET')
  console.log('')
}

console.log('Register these callback URLs in each provider console:')
console.log(`  Google: ${oauthCallbackUrl('google')}`)
console.log(`  GitHub: ${oauthCallbackUrl('github')}`)
