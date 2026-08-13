import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { loadProductImprovementWorkspace } from '@/lib/improvements/service'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) return apiError('Sign in to view Product attention', 401)

    const { id } = await context.params
    const workspace = await loadProductImprovementWorkspace(id, session.user.id)
    if (!workspace) return apiError('Product not found', 404)
    return NextResponse.json(workspace)
  } catch (error) {
    return handleRouteError(error, 'Could not load Product attention')
  }
}
