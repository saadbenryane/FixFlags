import { ImageResponse } from 'next/og'
import { IconOgImage } from '@/lib/design/og-templates'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(<IconOgImage />, { ...size })
}
