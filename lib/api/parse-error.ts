import { REQUEST_ERROR_COPY } from '@/lib/marketing/copy/errors'

export interface ParsedApiError {
  message: string
  code?: string
  action?: string
  estimatedWaitSeconds?: number
}

/** Accept the already-read body when a bounded transport owns consumption. */
export async function parseApiErrorResponse(res: Response, parsedBody?: unknown): Promise<ParsedApiError> {
  try {
    const data = (parsedBody === undefined ? await res.json() : parsedBody) as {
      code: string
      message: string
      action?: string
      requestId: string
      estimatedWaitSeconds?: number
    }
    if (data && typeof data.message === 'string') {
      return {
        message: data.message,
        code: typeof data.code === 'string' ? data.code : undefined,
        action: typeof data.action === 'string' ? data.action : undefined,
        estimatedWaitSeconds:
          typeof data.estimatedWaitSeconds === 'number' ? data.estimatedWaitSeconds : undefined,
      }
    }
  } catch {
    // non-JSON body
  }

  let message = 'Something went wrong. Try again.'
  let estimatedWaitSeconds: number | undefined

  // A parseable JSON body with the real cause (e.g. "Database is not configured")
  // is handled above via data.message; this only fires for a bare, non-JSON 503
  // (a platform-level outage page returned before the request reached the app),
  // so keep it end-user language, not the operator-facing detail that case has.
  if (res.status === 503) message = 'Service temporarily unavailable. Try again in a few minutes.'
  if (res.status === 402) message = 'Scan limit reached.'
  if (res.status === 400) message = 'Invalid request.'
  if (res.status === 429) {
    const retryAfter = res.headers.get('Retry-After')
    const seconds = retryAfter ? parseInt(retryAfter, 10) : 60
    const wait = Number.isFinite(seconds) && seconds > 0 ? seconds : 60
    estimatedWaitSeconds = wait
    message = REQUEST_ERROR_COPY.rateLimited(wait)
  }

  return {
    message,
    code: res.status === 429 ? 'RATE_LIMITED' : undefined,
    estimatedWaitSeconds,
  }
}
