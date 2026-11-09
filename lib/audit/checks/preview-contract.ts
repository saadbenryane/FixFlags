export const PUBLIC_PREVIEW_VERSION = 2
export const PREVIEW_DECLARATION_CHECKS = ['og-image-missing', 'og-title-missing', 'og-description-missing'] as const
export const PUBLIC_PREVIEW_VERIFICATION_RULE = 'Check the same public page and confirm the declaration in its HTML head.'

export function isPreviewDeclarationCheck(id: string) {
  return (PREVIEW_DECLARATION_CHECKS as readonly string[]).includes(id)
}

export function usesPublicPreviewImage(checks: Readonly<Record<string, number>> | undefined) {
  return checks?.['og-image-broken'] === PUBLIC_PREVIEW_VERSION
}

export function usesPublicPreviewDeclarations(checks: Readonly<Record<string, number>> | undefined) {
  return PREVIEW_DECLARATION_CHECKS.some(id => checks?.[id] === PUBLIC_PREVIEW_VERSION)
}

export function usesPublicPreview(checks: Readonly<Record<string, number>> | undefined) {
  return usesPublicPreviewImage(checks) || usesPublicPreviewDeclarations(checks)
}
