import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { prisma } from '@/lib/db'
import { canScanRepositories } from '@/lib/auth/entitlements'
import {
  parseScanAccessInput,
  redactScanAccessForClient,
  scanAccessInputSchema,
} from '@/lib/audit/scan-access'
import { persistProjectScanAccess } from '@/lib/audit/scan-access-store'
import { decryptScanAccess } from '@/lib/audit/scan-access'

const bodySchema = z.object({
  scanAccess: scanAccessInputSchema.nullable().optional(),
})

async function assertAgencyProjectOwner(projectId: string, userId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true, scanAccessEncrypted: true },
  })
  if (!project) return { kind: 'not_found' as const }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, plan: true, subscriptionStatus: true },
  })
  if (!user) return { kind: 'unauthorized' as const }
  if (!canScanRepositories(user)) {
    return { kind: 'upgrade_required' as const }
  }
  return { kind: 'ok' as const, project }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return apiError('Sign in required', 401)

    const { id } = await params
    const access = await assertAgencyProjectOwner(id, session.user.id)
    if (access.kind === 'not_found') return apiError('Project not found', 404)
    if (access.kind === 'unauthorized') return apiError('Sign in required', 401)
    if (access.kind === 'upgrade_required') {
      return apiError('Preview scan access requires the Studio plan', 402, {
        code: 'UPGRADE_REQUIRED',
        action: 'view_pricing',
      })
    }

    const config = decryptScanAccess(access.project.scanAccessEncrypted)
    return NextResponse.json({
      configured: Boolean(config),
      summary: config ? redactScanAccessForClient(config) : null,
    })
  } catch (err) {
    return handleRouteError(err)
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return apiError('Sign in required', 401)

    const { id } = await params
    const access = await assertAgencyProjectOwner(id, session.user.id)
    if (access.kind === 'not_found') return apiError('Project not found', 404)
    if (access.kind === 'unauthorized') return apiError('Sign in required', 401)
    if (access.kind === 'upgrade_required') {
      return apiError('Preview scan access requires the Studio plan', 402, {
        code: 'UPGRADE_REQUIRED',
        action: 'view_pricing',
      })
    }

    const body = await req.json().catch(() => ({}))
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? 'Invalid scan access payload', 400)
    }

    const config =
      parsed.data.scanAccess === null
        ? null
        : parseScanAccessInput(parsed.data.scanAccess)
    if (parsed.data.scanAccess && !config) {
      return apiError('Scan access must include HTTP basic auth, cookies, or headers', 400)
    }

    await persistProjectScanAccess(id, session.user.id, config)
    return NextResponse.json({
      configured: Boolean(config),
      summary: config ? redactScanAccessForClient(config) : null,
    })
  } catch (err) {
    return handleRouteError(err)
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return apiError('Sign in required', 401)

    const { id } = await params
    const access = await assertAgencyProjectOwner(id, session.user.id)
    if (access.kind === 'not_found') return apiError('Project not found', 404)
    if (access.kind === 'unauthorized') return apiError('Sign in required', 401)
    if (access.kind === 'upgrade_required') {
      return apiError('Preview scan access requires the Studio plan', 402, {
        code: 'UPGRADE_REQUIRED',
        action: 'view_pricing',
      })
    }

    await persistProjectScanAccess(id, session.user.id, null)
    return NextResponse.json({ configured: false, summary: null })
  } catch (err) {
    return handleRouteError(err)
  }
}
