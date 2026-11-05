'use client'

import { createContext, useContext } from 'react'
import type { SiteWorkspaceOrigin } from '@/lib/sites/workspace-location'

const Context = createContext<SiteWorkspaceOrigin | null>(null)

/** Publishes the navigation owner's current location without a second copy of its state. */
export const SiteWorkspaceLocationProvider = Context.Provider
export const useSiteWorkspaceLocation = () => useContext(Context)
