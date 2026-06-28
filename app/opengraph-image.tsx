import { ImageResponse } from 'next/og'
import { BRAND, HERO } from '@/lib/marketing/copy'
import { BRAND_HEX } from '@/lib/design/brand-spec'

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
          backgroundColor: BRAND_HEX.background,
          padding: '80px',
        }}
      >
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: BRAND_HEX.foreground,
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
            color: BRAND_HEX.mutedForeground,
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
