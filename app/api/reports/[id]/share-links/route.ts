import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { handleRouteError, apiError } from '@/lib/api/errors'
import {
  createManagedShareLink,
  listManagedShareLinks,
  revokeManagedShareLink,
  ShareLinkServiceError,
} from '@/lib/security/share-links'

const createShareLinkSchema = z.object({
  label: z.string().trim().min(1).max(100).nullable().optional(),
  password: z.string().min(10).max(200).nullable().optional(),
  expiresAt: z.coerce.date().refine((date) => date.getTime() > Date.now(), 'Expiry must be in the future').nullable().optional(),
  maxViews: z.number().int().min(1).max(1_000_000).nullable().optional(),
})

function shareLinkError(error: unknown) {
  if (error instanceof ShareLinkServiceError) {
    return apiError(error.message, error.status, {
      ...(error.code ? { code: error.code } : {}),
      ...(error.action ? { action: error.action } : {}),
    })
  }
  return handleRouteError(error)
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth.api
      .getSession({ headers: await headers() })
      .catch(() => null)

    return NextResponse.json(await listManagedShareLinks(id, session?.user))
  } catch (err) {
    return shareLinkError(err)
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth.api
      .getSession({ headers: await headers() })
      .catch(() => null)

    const parsed = createShareLinkSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? 'Invalid share link settings', 400, {
        code: 'INVALID_SHARE_LINK',
      })
    }
    return NextResponse.json(
      await createManagedShareLink(id, session?.user, parsed.data)
    )
  } catch (err) {
    return shareLinkError(err)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const shareId = url.searchParams.get('shareId')
    if (!shareId) return apiError('shareId required', 400)

    const session = await auth.api
      .getSession({ headers: await headers() })
      .catch(() => null)
    return NextResponse.json(await revokeManagedShareLink(shareId, session?.user))
  } catch (err) {
    return shareLinkError(err)
  }
}
