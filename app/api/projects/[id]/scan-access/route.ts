import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { prisma } from '@/lib/db'
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

async function assertProjectOwner(projectId: string, userId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true, scanAccessEncrypted: true },
  })
  if (!project) return null
  return project
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return apiError('Sign in required', 401)

    const { id } = await params
    const project = await assertProjectOwner(id, session.user.id)
    if (!project) return apiError('Project not found', 404)

    const config = decryptScanAccess(project.scanAccessEncrypted)
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
    const project = await assertProjectOwner(id, session.user.id)
    if (!project) return apiError('Project not found', 404)

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
    const project = await assertProjectOwner(id, session.user.id)
    if (!project) return apiError('Project not found', 404)

    await persistProjectScanAccess(id, session.user.id, null)
    return NextResponse.json({ configured: false, summary: null })
  } catch (err) {
    return handleRouteError(err)
  }
}
