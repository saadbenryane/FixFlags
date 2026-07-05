import { auth } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { toNextJsHandler } from 'better-auth/next-js'

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

export const GET = withErrorLogging(baseGET)
export const POST = withErrorLogging(basePOST)
