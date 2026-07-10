import { NextRequest, NextResponse } from 'next/server'
import { detectPlaceholders } from '@/lib/tools/placeholder-detector'

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    const result = await detectPlaceholders(url)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Failed to detect placeholders' }, { status: 500 })
  }
}
