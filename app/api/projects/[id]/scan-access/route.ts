import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { apiError, handleRouteError } from '@/lib/api/errors'
import {
  parseScanAccessInput,
  scanAccessInputSchema,
} from '@/lib/audit/scan-access'
import { readSavedScanAccess, saveScanAccess } from '@/lib/sites/application/scan-access-commands'

const bodySchema = z.object({
  scanAccess: scanAccessInputSchema.nullable(),
}).strict()

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return apiError('Sign in required', 401)

    const { id } = await params

    return NextResponse.json(await readSavedScanAccess(id, session.user.id))
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

    return NextResponse.json(await saveScanAccess(id, session.user.id, config))
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

    return NextResponse.json(await saveScanAccess(id, session.user.id, null))
  } catch (err) {
    return handleRouteError(err)
  }
}
