import { ImageResponse } from 'next/og'
import { BRAND } from '@/lib/marketing/copy'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0a',
          borderRadius: 8,
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#22c55e',
            fontFamily: 'monospace',
            letterSpacing: '-0.02em',
          }}
        >
          {BRAND.name.slice(0, 2).toUpperCase()}
        </div>
      </div>
    ),
    { ...size }
  )
}
