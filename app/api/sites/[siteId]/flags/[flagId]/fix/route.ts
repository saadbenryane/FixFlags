import { NextRequest, NextResponse } from 'next/server'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { COPIED_HANDOFF_CLIENT } from '@/lib/improvements/handoff-contract'
import { z } from 'zod'
import { executeSiteCommand } from '@/lib/sites/application/commands'
import { loadSiteFlagCopyTask } from '@/lib/sites/application/flag-copy-task'
import { SiteRunRefusal } from '@/lib/sites/application/run-refusal'
import { requireSiteOwner } from '@/lib/sites/request-access'
import { handleRouteError, apiError } from '@/lib/api/errors'

const schema = z.object({
  action: z.enum(['prepare', 'copy']),
  promptHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
})

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ siteId: string; flagId: string }> }
) {
  try {
    const { siteId, flagId } = await context.params
    const access = await requireSiteOwner(siteId)
    if (!access.ok) return apiError(access.message, access.status)
    const userId = access.decision.site.userId
    if (!userId) return apiError('Claim this Site first.', 403)
    const body = schema.safeParse(await req.json().catch(() => ({})))
    if (!body.success) return apiError('Invalid action', 400)

    const task = await loadSiteFlagCopyTask(access.decision.site.siteId, flagId,
      body.data.action === 'copy' ? body.data.promptHash : undefined)
    if (body.data.action === 'prepare') return NextResponse.json({ ok: true, ...task })
    const recorded = await executeSiteCommand({
      type: 'RECORD_FIX_HANDOFF',
      flagId: task.sourceFlagId,
      userId,
      builder: 'copy',
      client: body.data.promptHash ? COPIED_HANDOFF_CLIENT : undefined,
    })
    const handoff = 'handoff' in recorded ? recorded.handoff : null
    if (!handoff) return apiError(SITE_ACTION_COPY.invalidResponse, 500)

    return NextResponse.json({ ok: true, prompt: task.prompt, handoff })
  } catch (error) {
    if (error instanceof SiteRunRefusal) return apiError(error.message, error.status, { code: error.code })
    return handleRouteError(error)
  }
}
