import { ImageResponse } from 'next/og'
import { IconOgImage } from '@/lib/design/og-templates'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(<IconOgImage size={180} />, { ...size })
}
