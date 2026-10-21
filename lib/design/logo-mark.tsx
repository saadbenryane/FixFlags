import { readFileSync } from 'node:fs'
import { join } from 'node:path'

type LogoMarkProps = {
  /** Retained for call-site compatibility with older OG templates. */
  barColor?: string
  flagColor?: string
  width?: number
  height?: number
  className?: string
  /** Preloaded data URL or ArrayBuffer for Satori (opengraph routes). */
  src?: string | ArrayBuffer
}

let cachedMarkDataUrl: string | null = null

/** Official mark PNG as a data URL for Node OG rendering. */
export function getOfficialLogoMarkDataUrl(): string {
  if (cachedMarkDataUrl) return cachedMarkDataUrl
  const buf = readFileSync(join(process.cwd(), 'public/brand/logo-mark.png'))
  cachedMarkDataUrl = `data:image/png;base64,${buf.toString('base64')}`
  return cachedMarkDataUrl
}

/**
 * Official FixFlags mark, rasterized from the cleaned owner vector.
 * Pass `src` from `getOfficialLogoMarkDataUrl()` in OG routes.
 * Browser Logo components use the vector directly.
 */
export function LogoMarkSvg({ width = 40, height = 40, className, src }: LogoMarkProps) {
  const imageSrc = src ?? '/brand/logo-mark.png'

  return (
    // Satori + Next ImageResponse accept img; browser Logo uses next/image instead.
    // eslint-disable-next-line @next/next/no-img-element -- OG/Satori path
    <img
      src={imageSrc as string}
      width={width}
      height={height}
      alt=""
      className={className}
      style={{ objectFit: 'contain' }}
    />
  )
}
