import { buildLlmsTxt } from '@/lib/marketing/llms-txt'

export async function GET() {
  return new Response(buildLlmsTxt(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
