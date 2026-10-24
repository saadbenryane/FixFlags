import { notFound } from 'next/navigation'
import { CareHomepage } from '@/components/marketing/homepage/CareHomepage'

/** Local design review uses the existing illustrative sample, never tenant records. */
export default function SiteDashboardPreview() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <main className="mx-auto w-full max-w-7xl p-3 sm:p-6"><CareHomepage dashboardOnly /></main>
}
