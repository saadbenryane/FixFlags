import { ImageResponse } from 'next/og'
import { BRAND, SEO } from '@/lib/marketing/copy'

export const runtime = 'edge'
export const alt = BRAND.tagline
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          backgroundColor: '#0a0a0a',
          padding: '80px',
        }}
      >
        <div
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: '#ffffff',
            lineHeight: 1.2,
            marginBottom: 24,
          }}
        >
          {BRAND.name}
        </div>
        <div
          style={{
            fontSize: 36,
            color: '#a3a3a3',
            lineHeight: 1.4,
            maxWidth: 900,
          }}
        >
          {BRAND.tagline}
        </div>
        <div
          style={{
            marginTop: 40,
            fontSize: 22,
            color: '#737373',
          }}
        >
          {SEO.home.description.slice(0, 100)}...
        </div>
      </div>
    ),
    { ...size }
  )
}
