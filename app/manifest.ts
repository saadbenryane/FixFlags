import type { MetadataRoute } from 'next'
import { BRAND } from '@/lib/marketing/copy'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.name,
    description: BRAND.oneLiner,
    start_url: '/',
    display: 'standalone',
    background_color: '#fefcfa',
    theme_color: '#7a5c38',
    icons: [
      { src: '/icon', sizes: '32x32', type: 'image/png' },
    ],
  }
}
