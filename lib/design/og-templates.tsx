import { BRAND, HERO } from '@/lib/marketing/copy'
import { BRAND_HEX, brandDark, getBrandPalette, scoreColorHex, type BrandMode } from '@/lib/design/brand-spec'
import { ogFontFamilies } from '@/lib/design/fonts'
import { LogoMarkSvg } from '@/lib/design/logo-mark'
import { rubricLabel } from '@/lib/utils'

type RubricOgRow = {
  name: string
  status: string
}

function OgLogoRow({ mode }: { mode: BrandMode }) {
  const p = getBrandPalette(mode)
  const barColor = mode === 'dark' ? brandDark.foreground : BRAND_HEX.foreground

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
      <LogoMarkSvg barColor={barColor} flagColor={p.brand} width={48} height={48} />
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: p.foreground,
          fontFamily: ogFontFamilies.sans,
          letterSpacing: '-0.02em',
        }}
      >
        {BRAND.name}
      </div>
    </div>
  )
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
        padding: '72px 80px',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          maxWidth: 580,
        }}
      >
        <OgLogoRow mode={mode} />
        <div
          style={{
            fontSize: 48,
            fontWeight: 500,
            color: p.brand,
            lineHeight: 1.15,
            marginBottom: 16,
            fontFamily: ogFontFamilies.sans,
            letterSpacing: '-0.02em',
          }}
        >
          {HERO.headlineAccent}
        </div>
        <div
          style={{
            fontSize: 48,
            fontWeight: 500,
            color: p.foreground,
            lineHeight: 1.15,
            marginBottom: 28,
            fontFamily: ogFontFamilies.sans,
            letterSpacing: '-0.02em',
          }}
        >
          {`${HERO.headlineLine1} ${HERO.headlineLine2}`}
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            fontSize: 20,
            color: p.mutedForeground,
            lineHeight: 1.5,
            maxWidth: 480,
            fontFamily: ogFontFamilies.sans,
            gap: 4,
          }}
        >
          <span>FLAG ISSUES.</span>
          <span style={{ color: p.brand, fontWeight: 700 }}>FOCUS</span>
          <span>WHAT MATTERS.</span>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: p.card,
          borderRadius: 12,
          padding: '40px 48px',
          border: `1px solid ${p.border}`,
          boxShadow: '0 8px 32px -8px rgba(15,17,21,0.1)',
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: p.brand,
            fontFamily: ogFontFamilies.mono,
            lineHeight: 1,
            marginBottom: 4,
          }}
        >
          78
        </div>
        <div
          style={{
            fontSize: 18,
            color: p.mutedForeground,
            fontFamily: ogFontFamilies.mono,
            marginBottom: 16,
          }}
        >
          / 100
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: p.brand,
            backgroundColor: `${p.brand}14`,
            borderRadius: 6,
            padding: '6px 14px',
            fontFamily: ogFontFamilies.sans,
          }}
        >
          fix prompts included
        </div>
      </div>
    </div>
  )
}

/** Favicon / app icon - official FixFlags mark for light surfaces */
export function IconOgImage({ size = 32 }: { size?: number }) {
  const markSize = Math.round((size / 32) * 28)

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
      }}
    >
      <LogoMarkSvg
        barColor={BRAND_HEX.foreground}
        flagColor={BRAND_HEX.primary}
        width={markSize}
        height={markSize}
      />
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
        <OgLogoRow mode={mode} />
        <div
          style={{
            fontSize: 40,
            fontWeight: 500,
            color: p.foreground,
            textAlign: 'center',
            fontFamily: ogFontFamilies.sans,
            letterSpacing: '-0.01em',
          }}
        >
          Finish what your AI started
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
        <OgLogoRow mode={mode} />
        <div
          style={{
            fontSize: 36,
            fontWeight: 600,
            color: p.foreground,
            fontFamily: ogFontFamilies.sans,
            letterSpacing: '-0.01em',
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
        <div style={{ fontSize: 18, color: p.mutedForeground, fontFamily: ogFontFamilies.sans }}>
          Want your own report?
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            backgroundColor: p.card,
            borderRadius: 12,
            padding: '28px 40px',
            border: `1px solid ${p.border}`,
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
