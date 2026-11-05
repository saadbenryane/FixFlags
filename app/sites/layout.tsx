import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { BRAND } from '@/lib/marketing/copy/brand'

export const metadata: Metadata = {
  title: BRAND.name,
  robots: { index: false, follow: false },
}

export default function SitesLayout({ children }: { children: ReactNode }) {
  return children
}
