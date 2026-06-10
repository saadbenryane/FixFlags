'use client'
import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Monitor, Smartphone } from 'lucide-react'

interface Screenshot {
  device: 'DESKTOP' | 'MOBILE'
  url: string
}

interface Props {
  screenshots: Screenshot[]
}

export function ScreenshotViewer({ screenshots }: Props) {
  const desktop = screenshots.find((s) => s.device === 'DESKTOP')
  const mobile = screenshots.find((s) => s.device === 'MOBILE')

  if (!desktop && !mobile) return null

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
        <TabsContent value="desktop">
          <div className="rounded-lg overflow-hidden border shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={desktop.url} alt="Desktop screenshot" className="w-full" />
          </div>
        </TabsContent>
      )}
      {mobile && (
        <TabsContent value="mobile">
          <div className="max-w-sm mx-auto rounded-lg overflow-hidden border shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mobile.url} alt="Mobile screenshot" className="w-full" />
          </div>
        </TabsContent>
      )}
    </Tabs>
  )
}
