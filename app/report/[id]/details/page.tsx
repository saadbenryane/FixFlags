import type { Metadata } from 'next'
import { ReportRoute } from '../page'

export const metadata: Metadata = {
  title: 'Full review',
  robots: { index: false, follow: false },
}

export default function ReportDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  return <ReportRoute params={params} mode="details" />
}
