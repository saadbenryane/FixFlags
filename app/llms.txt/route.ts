import { buildLlmsTxt } from '@/lib/marketing/llms-txt'

export const dynamic = 'force-static'

export async function GET() {
  return new Response(buildLlmsTxt(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
