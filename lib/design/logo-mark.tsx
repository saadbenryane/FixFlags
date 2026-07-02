import { BRAND_HEX } from '@/lib/design/brand-spec'

type LogoMarkProps = {
  /** Retained for call-site compatibility; the mark is a single-color flag. */
  barColor?: string
  flagColor?: string
  width?: number
  height?: number
}

/**
 * FixFlags mark traced from the supplied reference lockup. The full lockup
 * uses the reference raster so the serif wordmark stays exact; this SVG is
 * the standalone mark for icons, OG, and compact UI.
 */
export function LogoMarkSvg({
  flagColor = BRAND_HEX.primary,
  width = 40,
  height = 40,
}: LogoMarkProps) {
  const highlightColor = flagColor === BRAND_HEX.primary ? BRAND_HEX.primaryLight : flagColor

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="fixflags-pole" x1="6.4" y1="24" x2="15" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={flagColor} />
          <stop offset="0.48" stopColor={highlightColor} />
          <stop offset="1" stopColor={flagColor} />
        </linearGradient>
        <linearGradient id="fixflags-flag" x1="13.5" y1="8" x2="43" y2="31" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={highlightColor} />
          <stop offset="0.42" stopColor={flagColor} />
          <stop offset="1" stopColor={flagColor} />
        </linearGradient>
      </defs>
      <rect x="6.5" y="4.2" width="8.5" height="39.6" rx="4.25" fill="url(#fixflags-pole)" />
      <path
        d="M14.2 8.1C20.5 4.6 26.7 6.6 31.8 9.6C35.6 11.8 39.2 11.5 42.8 9.8C41.7 15.4 38 19.2 31.1 21.8C35.4 24.8 37.5 30.5 43 29.6C35.2 33.5 28.4 32.3 22.2 27.2C19 24.6 16.4 24.3 14.2 26.2Z"
        fill="url(#fixflags-flag)"
      />
    </svg>
  )
}
