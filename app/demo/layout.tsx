import type { Metadata } from 'next'
import './demo.css'

/** Strip root marketing metadata (description, og:image) from demo fixtures. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
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
