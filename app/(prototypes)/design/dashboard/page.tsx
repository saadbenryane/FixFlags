import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DashboardRefinementStudy } from '@/components/design/DashboardRefinementStudy'

export const metadata: Metadata = {
  title: 'Dashboard refinement | FixFlags',
  robots: { index: false, follow: false },
}

export default function DashboardDesignStudy() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <DashboardRefinementStudy />
}
