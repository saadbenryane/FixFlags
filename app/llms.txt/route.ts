import { buildLlmsTxt } from '@/lib/marketing/llms-txt'
import { getIndexableIssueCheckIds } from '@/lib/graph/queries'

export const dynamic = 'force-dynamic'

export async function GET() {
  const research = await getIndexableIssueCheckIds().catch(() => [])
  return new Response(buildLlmsTxt({ hasReviewedResearch: research.length > 0 }), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
