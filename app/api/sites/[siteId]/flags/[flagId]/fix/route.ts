import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { executeSiteCommand } from '@/lib/sites/application/commands'
import { loadSiteBoardFlag } from '@/lib/sites/application/queries'
import { requireSiteAccess } from '@/lib/sites/request-access'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { boardFlagPrompt } from '@/lib/sites/board-card'

const schema = z.object({
  action: z.enum(['copy']),
})

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ siteId: string; flagId: string }> }
) {
  try {
    const { siteId, flagId } = await context.params
    const access = await requireSiteAccess(siteId)
    if (!access.ok) return apiError(access.message, access.status)

    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
    const body = schema.safeParse(await req.json().catch(() => ({})))
    if (!body.success) return apiError('Invalid action', 400)

    const detail = await loadSiteBoardFlag(access.decision.site.siteId, flagId)
    if (!detail) return apiError('Flag not found', 404)
    const prompt = boardFlagPrompt({
      problem: detail.flag.problem,
      whyItMatters: detail.flag.whyItMatters,
      evidence: detail.flag.evidenceMissing ? null : detail.flag.evidence,
      fix: detail.flag.fix,
      pageUrl: detail.flag.pageUrl,
      journeyName: detail.flag.relatedOutcome?.name,
      expectedBehavior: detail.flag.expectedBehavior,
    })

    let handoff = null
    if (session?.user?.id) {
      const recorded = await executeSiteCommand({
        type: 'RECORD_FIX_HANDOFF',
        flagId: detail.flag.sourceFlagId ?? detail.flag.id,
        userId: session.user.id,
        builder: 'copy',
      })
      handoff = 'handoff' in recorded ? recorded.handoff : null
    }

    return NextResponse.json({ ok: true, prompt, handoff })
  } catch (error) {
    return handleRouteError(error)
  }
}
