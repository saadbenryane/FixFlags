import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { canManageAudit } from '@/lib/audit/access'
import { apiError, handleRouteError } from '@/lib/api/errors'
import {
  buildUserProductContract,
  validateProductContractInput,
} from '@/lib/audit/product-contract'
import { mergeContractIntoProductIntelligence } from '@/lib/audit/product-intelligence'
import {
  ensureProductProject,
  saveProjectIntelligence,
  loadProjectIntelligence,
} from '@/lib/audit/ensure-product-project'
import { enforceRateLimit, requestClientId } from '@/lib/security/rate-limit'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
    const clientId = requestClientId(await headers())
    await enforceRateLimit({
      scope: 'product-contract',
      identifier: `${session?.user?.id ?? clientId}:${clientId}`,
      limit: 20,
      windowSeconds: 60,
    })

    const audit = await prisma.audit.findUnique({
      where: { id },
      select: { userId: true, status: true, url: true, projectId: true },
    })
    if (!audit) return apiError('Report not found', 404)
    if (!canManageAudit(audit, session?.user)) {
      return apiError('Sign in to edit the product contract', 401, {
        code: 'UNAUTHORIZED',
        action: 'sign_in',
      })
    }
    if (audit.status !== 'COMPLETED') {
      return apiError('Only completed reports can update the product contract', 400)
    }

    const body = await req.json().catch(() => null)
    const validated = validateProductContractInput(body)
    if (!validated.ok) {
      return apiError(validated.error, 400, { code: 'INVALID_CONTRACT' })
    }

    const productContract = buildUserProductContract(validated.value)

    let projectId = audit.projectId
    let mergeBase = projectId ? await loadProjectIntelligence(projectId) : null

    if (!projectId && audit.userId) {
      const project = await ensureProductProject(audit.userId, audit.url)
      projectId = project.id
      mergeBase = project.productIntelligence
    }

    const pi = mergeContractIntoProductIntelligence(mergeBase, productContract)

    const updated = await prisma.audit.update({
      where: { id },
      data: {
        productContract: productContract as object,
        ...(projectId ? { projectId } : {}),
      },
      select: { id: true, productContract: true, projectId: true },
    })

    if (projectId) {
      await saveProjectIntelligence(projectId, pi)
    }

    return NextResponse.json({
      id: updated.id,
      productContract,
      projectId: updated.projectId,
    })
  } catch (err) {
    return handleRouteError(err, 'Could not update product contract')
  }
}
