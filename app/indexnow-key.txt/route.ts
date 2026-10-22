import { validIndexNowKey } from '@/lib/growth/indexnow'

export const dynamic = 'force-dynamic'

export function GET() {
  const key = process.env.INDEXNOW_KEY
  if (!validIndexNowKey(key)) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  return new Response(key, { headers: {
    'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow',
    'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff',
  } })
}
