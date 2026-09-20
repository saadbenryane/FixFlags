import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { enforceRateLimit, requestClientId } from '@/lib/security/rate-limit'
import { WorkspaceChatUnavailableError } from '@/lib/workspace/chat'
import { getSiteAgentHistory, sendSiteAgentMessage, SiteAgentError } from '@/lib/sites/application/agent'

const schema = z.object({ message: z.string().trim().min(1).max(2000) })

async function userId() {
  return (await auth.api.getSession({ headers: await headers() }).catch(() => null))?.user?.id ?? null
}

function agentError(error: unknown) {
  if (error instanceof SiteAgentError) return apiError(error.message, error.status, { code: error.code })
  if (error instanceof WorkspaceChatUnavailableError) {
    return apiError('The Agent is temporarily unavailable. Your Site evidence is unchanged.', 503)
  }
  return handleRouteError(error, 'Agent unavailable')
}

export async function GET(_request: NextRequest, context: { params: Promise<{ siteId: string }> }) {
  try {
    const actor = await userId()
    if (!actor) return apiError('Sign in to use the Site Agent.', 401)
    const { siteId } = await context.params
    return NextResponse.json(await getSiteAgentHistory({ siteId, userId: actor }))
  } catch (error) {
    return agentError(error)
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ siteId: string }> }) {
  try {
    await enforceRateLimit({
      scope: 'site_agent',
      identifier: requestClientId(request.headers),
      limit: 20,
      windowSeconds: 60,
      onRedisDown: 'reject',
    })
    const actor = await userId()
    if (!actor) return apiError('Sign in to use the Site Agent.', 401)
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return apiError('Message required.', 400)
    const { siteId } = await context.params
    return NextResponse.json(await sendSiteAgentMessage({ siteId, userId: actor, message: parsed.data.message }))
  } catch (error) {
    return agentError(error)
  }
}
