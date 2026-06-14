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

  return { message }
}
