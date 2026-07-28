export interface ParsedApiError {
  message: string
  code?: string
  action?: string
  estimatedWaitSeconds?: number
}

/** Safely parse JSON error body from a fetch Response. */
export async function parseApiErrorResponse(res: Response): Promise<ParsedApiError> {
  try {
    const data = (await res.json()) as {
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
    message = `Your request is queued. Estimated wait: ${wait < 60 ? `${wait} seconds` : `about ${Math.ceil(wait / 60)} minute${wait >= 120 ? 's' : ''}`}. Browse examples or prep MCP while you wait.`
  }

  return {
    message,
    code: res.status === 429 ? 'RATE_LIMITED' : undefined,
    action: res.status === 429 ? 'queued' : undefined,
    estimatedWaitSeconds,
  }
}
