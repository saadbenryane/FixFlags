import { NextRequest, NextResponse } from 'next/server'
import { detectPlaceholders } from '@/lib/tools/placeholder-detector'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { enforceRateLimit, requestClientId } from '@/lib/security/rate-limit'

export async function POST(req: NextRequest) {
  try {
    const clientId = requestClientId(req.headers)
    await enforceRateLimit({ scope: 'tool-placeholder-detector', identifier: clientId, limit: 20, windowSeconds: 60 })

    const { url } = await req.json()
    if (!url || typeof url !== 'string') {
      return apiError('URL is required', 400)
    }

    const result = await detectPlaceholders(url)
    return NextResponse.json(result)
  } catch (error) {
    return handleRouteError(error, 'Failed to detect placeholders')
  }
}
