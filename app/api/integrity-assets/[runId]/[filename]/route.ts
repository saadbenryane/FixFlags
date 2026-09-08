import { NextResponse } from 'next/server'
import { readIntegrityArtifact } from '@/lib/integrity/storage'

export const runtime = 'nodejs'

function contentTypeFor(filename: string): string {
  if (filename.endsWith('.webm')) return 'video/webm'
  if (filename.endsWith('.gif')) return 'image/gif'
  if (filename.endsWith('.png')) return 'image/png'
  return 'application/octet-stream'
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ runId: string; filename: string }> }
) {
  const { runId, filename } = await context.params
  if (!runId || !filename || filename.includes('..') || filename.includes('/')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const bytes = await readIntegrityArtifact(runId, filename)
  if (!bytes) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': contentTypeFor(filename),
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
