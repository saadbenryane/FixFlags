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
      { src: '/favicon.ico', sizes: '48x48', type: 'image/x-icon' },
      { src: '/icon', sizes: '32x32', type: 'image/png' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      { src: '/brand/mark-light.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  }
}
