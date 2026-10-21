'use client'

import { useRef } from 'react'
import { Toaster } from 'sonner'
import { useFocusYield } from './useFocusYield'

export function Notifications() {
  const root = useRef<HTMLElement>(null)
  useFocusYield(root, '[data-sonner-toast][data-visible="true"]')
  const offset = { bottom: 'calc(var(--bottom-notice-inset, 0px) + 16px)' }
  return <Toaster ref={root} richColors position="bottom-right" offset={offset} mobileOffset={offset} />
}
