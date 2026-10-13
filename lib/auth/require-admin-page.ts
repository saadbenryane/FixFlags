import { cache } from 'react'
import { redirect } from 'next/navigation'
import { requireAdmin, isAdminResponse } from '@/lib/auth/require-admin'
import { getRequestedPath, signInUrl } from '@/lib/auth/redirect-path'

/** Check every admin entry point before querying data. Cache only for this render. */
export const requireAdminPage = cache(async () => {
  const admin = await requireAdmin()
  if (isAdminResponse(admin)) {
    if (admin.status === 401) {
      redirect(signInUrl(await getRequestedPath('/admin')))
    }
    if (admin.status === 403) redirect('/')
    throw new Error('Administrator access could not be verified. Please retry.')
  }
  return admin
})
