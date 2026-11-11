import { docsMarkdownResponse } from '@/lib/docs/markdown'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, context: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await context.params
  return docsMarkdownResponse(['/docs', ...slug].join('/'))
}
