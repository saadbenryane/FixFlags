'use client'

import { BrowserFrame } from '@/components/audit/BrowserFrame'
import {
  DESKTOP_FRAME_FLEX_CLASS,
  MOBILE_FRAME_WIDTH_CLASS,
  MOBILE_VIEWPORT,
  SCREENSHOT_FRAMES_ROW_CLASS,
} from '@/lib/audit/viewports'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Monitor, Smartphone } from 'lucide-react'
import type { AuditScreenshot } from '@/lib/audit/screenshot-types'
import { cn } from '@/lib/utils'

interface Props {
  screenshots: AuditScreenshot[]
  url?: string
}

function MobileFrame({ url, imageUrl }: { url?: string; imageUrl: string }) {
  return (
    <div
      className={MOBILE_FRAME_WIDTH_CLASS}
      title={`${MOBILE_VIEWPORT.width}×${MOBILE_VIEWPORT.height} viewport`}
    >
      <BrowserFrame device="mobile" url={url} imageUrl={imageUrl} state="loaded" />
    </div>
  )
}

function DesktopFrame({ url, imageUrl }: { url?: string; imageUrl: string }) {
  return <BrowserFrame device="desktop" url={url} imageUrl={imageUrl} state="loaded" />
}

export function ScreenshotViewer({ screenshots, url }: Props) {
  const desktop = screenshots.find((s) => s.device === 'DESKTOP')
  const mobile = screenshots.find((s) => s.device === 'MOBILE')

  if (!desktop && !mobile) return null

  if (!desktop && mobile) {
    return (
      <div className="flex justify-center">
        <MobileFrame url={url} imageUrl={mobile.url} />
      </div>
    )
  }

  return (
    <>
      <div className="lg:hidden w-full">
        <Tabs defaultValue="desktop">
          <TabsList>
            {desktop && (
              <TabsTrigger value="desktop" className="gap-2">
                <Monitor className="h-3.5 w-3.5" /> Desktop
              </TabsTrigger>
            )}
            {mobile && (
              <TabsTrigger value="mobile" className="gap-2">
                <Smartphone className="h-3.5 w-3.5" /> Mobile
              </TabsTrigger>
            )}
          </TabsList>
          {desktop && (
            <TabsContent value="desktop" className="mt-3 w-full">
              <DesktopFrame url={url} imageUrl={desktop.url} />
            </TabsContent>
          )}
          {mobile && (
            <TabsContent value="mobile" className="mt-3 w-full flex justify-center">
              <MobileFrame url={url} imageUrl={mobile.url} />
            </TabsContent>
          )}
        </Tabs>
      </div>

      <div className={cn('hidden lg:flex', SCREENSHOT_FRAMES_ROW_CLASS)}>
        {desktop && (
          <div className={DESKTOP_FRAME_FLEX_CLASS}>
            <DesktopFrame url={url} imageUrl={desktop.url} />
          </div>
        )}
        {mobile && <MobileFrame url={url} imageUrl={mobile.url} />}
      </div>
    </>
  )
}
