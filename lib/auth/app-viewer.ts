import { cache } from 'react'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

/** Request-scoped authenticated viewer shared by the app layout and pages. */
export const getAppViewer = cache(async () => {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null)
  if (!session?.user) return null

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })
  return user ? { session, user } : null
})
