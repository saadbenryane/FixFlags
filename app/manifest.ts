import type { MetadataRoute } from 'next'
import { BRAND } from '@/lib/marketing/copy'
import { manifestColors } from '@/lib/design/brand-spec'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.name,
    description: BRAND.oneLiner,
    start_url: '/',
    display: 'standalone',
    background_color: manifestColors.background_color,
    theme_color: manifestColors.theme_color,
    icons: [
      { src: '/icon', sizes: '32x32', type: 'image/png' },
      { src: '/brand/mark-light.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  }
}
