import { NextRequest, NextResponse } from 'next/server'
import { checkMetaPreview } from '@/lib/tools/meta-preview'
import { apiError } from '@/lib/api/errors'

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url || typeof url !== 'string') {
      return apiError('URL is required', 400)
    }

    const result = await checkMetaPreview(url)
    return NextResponse.json(result)
  } catch {
    return apiError('Failed to check meta preview', 500)
  }
}
