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
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#0a0a0a',
          padding: '80px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            maxWidth: 560,
          }}
        >
          <div
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: '#22c55e',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              fontFamily: 'monospace',
              marginBottom: 16,
            }}
          >
            {BRAND.name}
          </div>
          <div
            style={{
              fontSize: 42,
              fontWeight: 700,
              color: '#ffffff',
              lineHeight: 1.2,
              marginBottom: 20,
            }}
          >
            {HERO.headlineLine1}
          </div>
          <div
            style={{
              fontSize: 42,
              fontWeight: 700,
              color: '#ffffff',
              lineHeight: 1.2,
              marginBottom: 32,
            }}
          >
            {HERO.headlineLine2}
          </div>
          <div
            style={{
              fontSize: 20,
              color: '#737373',
              lineHeight: 1.5,
              maxWidth: 480,
            }}
          >
            Flags across Message, Experience, and Reach. Every issue includes a copy-ready fix prompt.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#141414',
            borderRadius: 16,
            padding: '40px 48px',
            border: '1px solid #262626',
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: '#f59e0b',
              fontFamily: 'monospace',
              lineHeight: 1,
              marginBottom: 4,
            }}
          >
            78
          </div>
          <div
            style={{
              fontSize: 20,
              color: '#525252',
              fontFamily: 'monospace',
              marginBottom: 16,
            }}
          >
            / 100
          </div>
          <div
            style={{
              fontSize: 16,
              color: '#22c55e',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              borderRadius: 8,
              padding: '6px 16px',
              fontFamily: 'monospace',
              border: '1px solid rgba(34, 197, 94, 0.2)',
            }}
          >
            fix prompts included
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
