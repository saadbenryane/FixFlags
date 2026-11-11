import { BRAND } from '@/lib/marketing/copy-barrel'
import { getBrandPalette, scoreColorHex, type BrandMode } from '@/lib/design/brand-spec'
import { ogFontFamilies } from '@/lib/design/fonts'
import { LogoMarkSvg, getOfficialLogoMarkDataUrl } from '@/lib/design/logo-mark'
import { rubricLabel } from '@/lib/utils'

type RubricOgRow = {
  name: string
  status: string
}

function OgLogoRow({ mode }: { mode: BrandMode }) {
  const p = getBrandPalette(mode)
  const markSrc = getOfficialLogoMarkDataUrl()

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
      <LogoMarkSvg src={markSrc} width={44} height={44} />
      <div
        style={{
          fontSize: 30,
          fontWeight: 500,
          color: p.foreground,
          fontFamily: ogFontFamilies.serif,
          letterSpacing: '-0.01em',
        }}
      >
        {BRAND.name}
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
        <OgLogoRow mode={mode} />
        <div
          style={{
            fontSize: 40,
            fontWeight: 500,
            color: p.foreground,
            textAlign: 'center',
            fontFamily: ogFontFamilies.serif,
            letterSpacing: '-0.01em',
          }}
        >
          Know when customers cannot buy
        </div>
        <div
          style={{
            fontSize: 22,
            color: p.mutedForeground,
            textAlign: 'center',
            fontFamily: ogFontFamilies.sans,
          }}
        >
          Protect the path that makes money
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
