import { BRAND_HEX } from '@/lib/design/brand-spec'

type LogoMarkProps = {
  /** Retained for call-site compatibility; the mark is a single-color flag. */
  barColor?: string
  flagColor?: string
  width?: number
  height?: number
}

/**
 * FixFlags mark: a clean waving flag. A rounded orange flagpole on the left
 * flies a soft wavy pennant to the right. Flat (no 3D), optically balanced
 * curves. Per the Final Brand Guideline; extracted from the brand art.
 * `barColor` is accepted for backward compatibility but the flag is one color.
 */
export function LogoMarkSvg({
  flagColor = BRAND_HEX.primary,
  width = 40,
  height = 40,
}: LogoMarkProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* Flagpole */}
      <rect x="9.5" y="4" width="5" height="40" rx="2.5" fill={flagColor} />
      {/* Waving pennant */}
      <path
        d="M14.5 6C23 2.5 30 10 41 6C39 12 39 18.5 41 24.5C30 28.5 23 21 14.5 25Z"
        fill={flagColor}
      />
    </svg>
  )
}
