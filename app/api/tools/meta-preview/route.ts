import { NextRequest, NextResponse } from 'next/server'
import { checkMetaPreview } from '@/lib/tools/meta-preview'

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    const result = await checkMetaPreview(url)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Failed to check meta preview' }, { status: 500 })
  }
}
