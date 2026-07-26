import { cache } from 'react'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { meUserSelect, serializeMeUser } from '@/lib/auth/me-user'

/** Request-scoped authenticated viewer shared by the app layout and pages. */
export const getAppViewer = cache(async () => {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null)
  if (!session?.user) return null

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: meUserSelect,
  })
  return user ? { session, user } : null
})

export const getAppMeUser = cache(async () => {
  const viewer = await getAppViewer()
  return viewer ? serializeMeUser(viewer.user, viewer.session.user) : null
})
