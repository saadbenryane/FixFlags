import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'QualityOS — Your agent built it. QualityOS checks if it works.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: 'linear-gradient(135deg, #0c0a14 0%, #1e1336 60%, #3b1d6e 100%)',
          color: '#fff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 48 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 14,
              background: '#7c3aed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 38,
              fontWeight: 700,
            }}
          >
            ✓
          </div>
          <div style={{ fontSize: 44, fontWeight: 700 }}>QualityOS</div>
        </div>
        <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.15, maxWidth: 950 }}>
          Your agent built it. QualityOS checks if it works.
        </div>
        <div style={{ fontSize: 30, marginTop: 36, color: '#c4b5fd', maxWidth: 900 }}>
          Evidence-backed website audits across 7 areas, with copy-paste fix prompts for your AI agent.
        </div>
      </div>
    ),
    size
  )
}
