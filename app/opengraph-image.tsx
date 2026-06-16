import { ImageResponse } from 'next/og'
import { SiteOgImage } from '@/lib/design/og-templates'
import { BRAND, HERO } from '@/lib/marketing/copy'

export const runtime = 'edge'
export const alt = `${BRAND.name} - ${HERO.headlineLine2}`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(<SiteOgImage mode="light" />, { ...size })
}
