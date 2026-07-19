/**
 * Visual capture system. Contextual visual evidence for audit flags.
 */
export { captureLoadFrames, captureInteractionFrames } from './frames'
export type { FrameSet, CapturedFrame, FrameCaptureOptions } from './frames'
export { composeGif, addTimerToFrame, addBadgeToFrame } from './gif-compositor'
export type { GifFrame, GifResult, GifComposeOptions } from './gif-compositor'
export { renderOverlay } from './overlays'
export type { OverlayContext, OverlayResult, OverlayTemplate } from './overlays'
export { captureVisualEvidence } from './visual-capture'
export type { VisualEvidence, VisualCaptureResult } from './visual-capture'
export { getVisualDescriptor, getGifCaptureCheckIds, getOverlayCheckIds, VISUAL_DESCRIPTORS } from './visual-types'
export type { VisualDescriptor, VisualType } from './visual-types'
