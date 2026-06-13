'use client'

import { BrowserFrame } from '@/components/audit/BrowserFrame'
import { MOBILE_VIEWPORT } from '@/lib/audit/viewports'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Monitor, Smartphone } from 'lucide-react'

interface Screenshot {
  device: 'DESKTOP' | 'MOBILE'
  url: string
}

interface Props {
  screenshots: Screenshot[]
  url?: string
  layout?: 'tabs' | 'responsive'
}

/** Phone-width frame — 375 CSS px at audit capture scale, capped for layout */
const MOBILE_FRAME_CLASS = 'w-[240px] max-w-full shrink-0'

function MobileFrame({ url, imageUrl }: { url?: string; imageUrl: string }) {
  return (
    <div className={MOBILE_FRAME_CLASS} title={`${MOBILE_VIEWPORT.width}×${MOBILE_VIEWPORT.height} viewport`}>
      <BrowserFrame device="mobile" url={url} imageUrl={imageUrl} state="loaded" />
    </div>
  )
}

function DesktopFrame({ url, imageUrl }: { url?: string; imageUrl: string }) {
  return <BrowserFrame device="desktop" url={url} imageUrl={imageUrl} state="loaded" />
}

export function ScreenshotViewer({ screenshots, url, layout = 'responsive' }: Props) {
  const desktop = screenshots.find((s) => s.device === 'DESKTOP')
  const mobile = screenshots.find((s) => s.device === 'MOBILE')

  if (!desktop && !mobile) return null

  const useTabsOnly = layout === 'tabs' || (!desktop && mobile)

  if (useTabsOnly) {
    return (
      <Tabs defaultValue={desktop ? 'desktop' : 'mobile'}>
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

      <div className="hidden lg:flex gap-6 items-start w-full">
        {desktop && (
          <div className="flex-1 min-w-0">
            <DesktopFrame url={url} imageUrl={desktop.url} />
          </div>
        )}
        {mobile && <MobileFrame url={url} imageUrl={mobile.url} />}
      </div>
    </>
  )
}
