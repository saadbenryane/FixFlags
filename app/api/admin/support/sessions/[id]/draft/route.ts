import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, isAdminResponse } from '@/lib/auth/require-admin'
import { prisma } from '@/lib/db'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { adminPrivateHeaders, requireAdminOrigin } from '@/lib/admin/http'
import { encryptSecret, decryptSecret } from '@/lib/security/crypto'
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdmin()
    if (isAdminResponse(actor)) return actor
    const sessionId = (await params).id
    const draft = await prisma.supportDraft.findUnique({
      where: { actorId_sessionId: { actorId: actor.id, sessionId } },
    })
    return NextResponse.json(
      { body: draft ? decryptSecret(draft.body) : '', revision: draft?.revision ?? 0 },
      { headers: adminPrivateHeaders },
    )
  } catch (err) {
    return handleRouteError(err)
  }
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAdminOrigin(req)
    const actor = await requireAdmin()
    if (isAdminResponse(actor)) return actor
    const { body, revision } = await req.json()
    if (
      typeof body !== 'string' ||
      body.length > 4000 ||
      !Number.isInteger(revision) ||
      revision < 0
    )
      return apiError('Invalid draft', 400)
    const sessionId = (await params).id
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "support_sessions" WHERE "id"=${sessionId} FOR UPDATE`
      const current = await tx.supportDraft.findUnique({
        where: { actorId_sessionId: { actorId: actor.id, sessionId } },
      })
      if ((current?.revision ?? 0) !== revision) return null
      return current
        ? tx.supportDraft.update({
            where: { id: current.id },
            data: { body: encryptSecret(body), revision: { increment: 1 } },
          })
        : tx.supportDraft.create({
            data: { actorId: actor.id, sessionId, body: encryptSecret(body) },
          })
    })
    return result
      ? NextResponse.json({ revision: result.revision }, { headers: adminPrivateHeaders })
      : apiError(
          'This draft changed in another window. Reload the conversation before editing.',
          409,
        )
  } catch (err) {
    return handleRouteError(err)
  }
}
