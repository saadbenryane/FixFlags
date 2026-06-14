export interface ParsedApiError {
  message: string
  code?: string
  action?: string
}

/** Safely parse JSON error body from a fetch Response. */
export async function parseApiErrorResponse(res: Response): Promise<ParsedApiError> {
  try {
    const data = (await res.json()) as {
      code: string
      message: string
      action?: string
      requestId: string
    }
    if (data && typeof data.message === 'string') {
      return {
        message: data.message,
        code: typeof data.code === 'string' ? data.code : undefined,
        action: typeof data.action === 'string' ? data.action : undefined,
      }
    }
  } catch {
    // non-JSON body
  }

  let message = 'Something went wrong. Please try again.'
  if (res.status === 503) message = 'Service temporarily unavailable. Check server configuration.'
  if (res.status === 402) message = 'Scan limit reached.'
  if (res.status === 400) message = 'Invalid request.'
  if (res.status === 429) {
    const retryAfter = res.headers.get('Retry-After')
    const seconds = retryAfter ? parseInt(retryAfter, 10) : 60
    const wait = Number.isFinite(seconds) && seconds > 0 ? seconds : 60
    message = `Too many requests. Please wait ${wait < 60 ? `${wait} seconds` : `about ${Math.ceil(wait / 60)} minute${wait >= 120 ? 's' : ''}`} before trying again.`
  }

  return { message, code: res.status === 429 ? 'RATE_LIMITED' : undefined, action: res.status === 429 ? 'retry' : undefined }
}
