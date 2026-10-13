import { requireAdminPage } from '@/lib/auth/require-admin-page'
import type { Metadata } from 'next'
import { AdminWorkspace } from '@/components/admin/AdminWorkspace'
import { BRAND } from '@/lib/marketing/copy'

export const metadata: Metadata = {
  title: BRAND.name,
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage()

  return <AdminWorkspace>{children}</AdminWorkspace>
}
