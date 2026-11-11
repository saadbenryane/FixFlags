import { fullDocsResponse } from '@/lib/docs/markdown'

export const dynamic = 'force-dynamic'

export async function GET() {
  return fullDocsResponse()
}
