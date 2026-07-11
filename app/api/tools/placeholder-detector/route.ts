import { NextRequest, NextResponse } from 'next/server'
import { detectPlaceholders } from '@/lib/tools/placeholder-detector'
import { apiError } from '@/lib/api/errors'

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url || typeof url !== 'string') {
      return apiError('URL is required', 400)
    }

    const result = await detectPlaceholders(url)
    return NextResponse.json(result)
  } catch {
    return apiError('Failed to detect placeholders', 500)
  }
}
