import { NextRequest, NextResponse } from 'next/server'
import { handleRouteError } from '@/lib/api/errors'
import { requireAdmin, isAdminResponse } from '@/lib/auth/require-admin'
import { buildFeedbackDigest } from '@/lib/admin/feedback-digest'

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (isAdminResponse(admin)) return admin

    const daysParam = Number(req.nextUrl.searchParams.get('days'))
    const days = Number.isFinite(daysParam) && daysParam > 0 ? daysParam : 30
    const format = req.nextUrl.searchParams.get('format')

    const digest = await buildFeedbackDigest({ days })

    if (format === 'md' || format === 'markdown') {
      const filename = `feedback-digest-${digest.since.toISOString().slice(0, 10)}.md`
      return new NextResponse(digest.markdown, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    }

    return NextResponse.json({ markdown: digest.markdown, counts: digest.counts })
  } catch (err) {
    return handleRouteError(err)
  }
}
