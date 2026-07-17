import { auth } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { toNextJsHandler } from 'better-auth/next-js'
import { recordRateLimit, requestClientId } from '@/lib/security/rate-limit'

const { GET: baseGET, POST: basePOST } = toNextJsHandler(auth)

function withErrorLogging(handler: typeof baseGET) {
  return async (request: Request) => {
    try {
      return await handler(request)
    } catch (error) {
      logger.error('Auth handler error', { err: error, url: request.url, method: request.method })
      return new Response('Internal Server Error', { status: 500 })
    }
  }
}

async function withAuthRateLimit(request: Request) {
  const clientId = requestClientId(new Headers(request.headers))
  await recordRateLimit({ scope: 'auth-endpoint', identifier: clientId, limit: 30, windowSeconds: 60 })
  return basePOST(request)
}

export const GET = withErrorLogging(baseGET)
export const POST = withErrorLogging(withAuthRateLimit)
