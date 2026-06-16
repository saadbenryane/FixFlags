import { BRAND, HERO } from '@/lib/marketing/copy'
import { getBrandPalette, scoreColorHex, type BrandMode } from '@/lib/design/brand-spec'
import { ogFontFamilies } from '@/lib/design/fonts'
import { rubricLabel } from '@/lib/utils'

type RubricOgRow = {
  name: string
  status: string
}

/** Site-wide marketing OG card (1200×630) */
export function SiteOgImage({ mode = 'light' }: { mode?: BrandMode }) {
  const p = getBrandPalette(mode)

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: p.background,
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
            color: p.brand,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            fontFamily: ogFontFamilies.mono,
            marginBottom: 16,
          }}
        >
          {BRAND.name}
        </div>
        <div
          style={{
            fontSize: 42,
            fontWeight: 700,
            color: p.foreground,
            lineHeight: 1.2,
            marginBottom: 20,
            fontFamily: ogFontFamilies.display,
          }}
        >
          {HERO.headlineLine1}
        </div>
        <div
          style={{
            fontSize: 42,
            fontWeight: 700,
            color: p.foreground,
            lineHeight: 1.2,
            marginBottom: 32,
            fontFamily: ogFontFamilies.display,
          }}
        >
          {HERO.headlineLine2}
        </div>
        <div
          style={{
            fontSize: 20,
            color: p.mutedForeground,
            lineHeight: 1.5,
            maxWidth: 480,
            fontFamily: ogFontFamilies.sans,
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
          backgroundColor: p.card,
          borderRadius: 20,
          padding: '40px 48px',
          boxShadow: '0 12px 40px -12px rgba(0,0,0,0.12)',
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: p.grades.C,
            fontFamily: ogFontFamilies.mono,
            lineHeight: 1,
            marginBottom: 4,
          }}
        >
          78
        </div>
        <div
          style={{
            fontSize: 20,
            color: p.mutedForeground,
            fontFamily: ogFontFamilies.mono,
            marginBottom: 16,
          }}
        >
          / 100
        </div>
        <div
          style={{
            fontSize: 16,
            color: p.brand,
            backgroundColor: `${p.brand}18`,
            borderRadius: 8,
            padding: '6px 16px',
            fontFamily: ogFontFamilies.mono,
          }}
        >
          fix prompts included
        </div>
      </div>
    </div>
  )
}

/** Favicon / app icon (32×32) */
export function IconOgImage({ mode = 'light' }: { mode?: BrandMode }) {
  const p = getBrandPalette(mode)

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: p.brand,
        borderRadius: 8,
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: p.brandForeground,
          fontFamily: ogFontFamilies.display,
          letterSpacing: '-0.02em',
        }}
      >
        {BRAND.name.slice(0, 2)}
      </div>
    </div>
  )
}

type ReportOgImageProps = {
  mode?: BrandMode
  hostname?: string
  topIssue?: string
  score?: number | null
  rubrics?: RubricOgRow[]
  generic?: boolean
}

/** Dynamic report share card */
export function ReportOgImage({
  mode = 'light',
  hostname = 'yoursite.com',
  topIssue = 'Automated QA report',
  score = null,
  rubrics = [],
  generic = false,
}: ReportOgImageProps) {
  const p = getBrandPalette(mode)
  const color = score != null ? scoreColorHex(score, mode) : p.mutedForeground

  if (generic) {
    return (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: p.background,
          padding: '64px 72px',
          gap: 24,
        }}
      >
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: p.brand,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontFamily: ogFontFamilies.mono,
          }}
        >
          {BRAND.name}
        </div>
        <div
          style={{
            fontSize: 42,
            fontWeight: 700,
            color: p.foreground,
            textAlign: 'center',
            fontFamily: ogFontFamilies.display,
          }}
        >
          QA for AI-built products
        </div>
        <div
          style={{
            fontSize: 22,
            color: p.mutedForeground,
            textAlign: 'center',
            fontFamily: ogFontFamilies.sans,
          }}
        >
          Message · Experience · Reach
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: p.background,
        padding: '64px 72px',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: p.brand,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontFamily: ogFontFamilies.mono,
          }}
        >
          {BRAND.name}
        </div>
        <div
          style={{
            fontSize: 36,
            fontWeight: 700,
            color: p.foreground,
            fontFamily: ogFontFamilies.display,
          }}
        >
          {hostname}
        </div>
        <div
          style={{
            fontSize: 22,
            color: p.mutedForeground,
            maxWidth: 900,
            lineHeight: 1.4,
            fontFamily: ogFontFamilies.sans,
          }}
        >
          {topIssue}
        </div>
        {rubrics.length > 0 && (
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            {rubrics.map((rubric) => (
              <div
                key={rubric.name}
                style={{
                  fontSize: 14,
                  color: p.mutedForeground,
                  fontFamily: ogFontFamilies.mono,
                }}
              >
                {rubricLabel(rubric.name)}: {rubric.status}
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 20, color: p.mutedForeground, fontFamily: ogFontFamilies.sans }}>
          Want your own report?
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            backgroundColor: p.card,
            borderRadius: 16,
            padding: '28px 40px',
            boxShadow: '0 6px 20px -4px rgba(0,0,0,0.08)',
          }}
        >
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              color,
              fontFamily: ogFontFamilies.mono,
              lineHeight: 1,
            }}
          >
            {score ?? '-'}
          </div>
          <div
            style={{
              fontSize: 18,
              color: p.mutedForeground,
              fontFamily: ogFontFamilies.mono,
            }}
          >
            / 100
          </div>
        </div>
      </div>
    </div>
  )
}
