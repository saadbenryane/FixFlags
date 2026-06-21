import { ImageResponse } from 'next/og'
import { BRAND, HERO } from '@/lib/marketing/copy'

export const runtime = 'edge'
export const alt = `${BRAND.name} - ${HERO.headlineLine2}`
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
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fff',
          padding: '80px',
        }}
      >
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: '#1a1a2e',
            fontFamily: 'system-ui',
            letterSpacing: '-0.02em',
            marginBottom: 16,
          }}
        >
          {BRAND.name}
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 28,
            color: '#6b7280',
            fontFamily: 'system-ui',
          }}
        >
          <span>{`${HERO.headlineLine1} ${HERO.headlineLine2}`}</span>
        </div>
      </div>
    ),
    { ...size }
  )
}
