import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { revokeGithubGrant } from '@/lib/integrations/github'
import { decryptSecret } from '@/lib/security/crypto'
import { apiError, handleRouteError } from '@/lib/api/errors'

export async function POST() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return apiError('Unauthorized', 401, { code: 'UNAUTHORIZED' })

    const connection = await prisma.githubConnection.findUnique({
      where: { userId: session.user.id },
    })
    if (!connection) return NextResponse.json({ ok: true })

    try {
      const accessToken = decryptSecret(connection.encryptedAccessToken)
      await revokeGithubGrant(accessToken)
    } catch {
      // Token may already be invalid/undecryptable - still remove our local record below.
    }

    await prisma.githubConnection.delete({ where: { userId: session.user.id } })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleRouteError(err, 'Failed to disconnect GitHub')
  }
}
