import { BRAND_HEX } from '@/lib/design/brand-spec'

type LogoMarkProps = {
  barColor?: string
  flagColor?: string
  width?: number
  height?: number
}

/** Five-bar flag mark matching brand guidelines */
export function LogoMarkSvg({
  barColor = BRAND_HEX.foreground,
  flagColor = BRAND_HEX.primary,
  width = 40,
  height = 40,
}: LogoMarkProps) {
  const barW = 5
  const gap = 3.5
  const baseY = 34
  const rx = 2.5
  const xs = [0, barW + gap, (barW + gap) * 2, (barW + gap) * 3, (barW + gap) * 4]
  const heights = [16, 22, 28, 22, 16]

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {xs.map((x, i) => {
        if (i === 2) {
          const h = heights[i]!
          return (
            <g key={x}>
              <rect x={x} y={baseY - h} width={barW} height={h} rx={rx} fill={flagColor} />
              <path
                d={`M${x + barW} ${baseY - h - 1} L${x + barW + 5} ${baseY - h + 3} L${x + barW} ${baseY - h + 6} Z`}
                fill={flagColor}
              />
            </g>
          )
        }
        const h = heights[i]!
        return <rect key={x} x={x} y={baseY - h} width={barW} height={h} rx={rx} fill={barColor} />
      })}
    </svg>
  )
}
