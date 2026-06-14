import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'QualityOS — AI checks every issue. Fix prompts included.'
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
        {/* Left: brand + tagline */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            maxWidth: 500,
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
            QualityOS
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
            Your agent built it.
          </div>
          <div
            style={{
              fontSize: 42,
              fontWeight: 700,
              color: '#a3a3a3',
              fontStyle: 'italic',
              lineHeight: 1.2,
              marginBottom: 32,
            }}
          >
            QualityOS checks it.
          </div>
          <div
            style={{
              fontSize: 20,
              color: '#737373',
              lineHeight: 1.5,
              maxWidth: 420,
            }}
          >
            AI reviews screenshots across 7 areas. Every issue includes a fix prompt your agent can run.
          </div>
        </div>

        {/* Right: score card */}
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
            7 areas · fix prompts
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
