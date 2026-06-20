import type { Metadata } from 'next'
import './demo.css'

/** Strip root marketing metadata defaults; each fixture page owns robots/canonical. */
export const metadata: Metadata = {
  description: '',
  openGraph: {
    images: [],
  },
  twitter: {
    images: [],
  },
}

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children
}
