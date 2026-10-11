const DISPLAY_SURFACES = [
  /^app\/\(marketing\)\//,
  /^app\/opengraph-image/,
  /^app\/\(docs\)\//,
  /^components\/(?:marketing|pricing|brand|help|docs|knowledge)\//,
]

const PANEL = /className=(?:"[^"]*rounded-(xl|lg)[^"]*(?:border|bg-|shadow|\sp-\d)[^"]*"|'[^']*rounded-(xl|lg)[^']*(?:border|bg-|shadow|\sp-\d)[^']*')/
const CN_PANEL = /cn\([^)]*['"`][^'"`]*rounded-(xl|lg)[^'"`]*(?:\sborder|\sbg-)/

/** Visual conventions only. Product behavior checks remain in ui-drift-guard. */
export function uiStyleFailures(file, source) {
  const failures = []
  if (source.includes('font-display') && !DISPLAY_SURFACES.some(pattern => pattern.test(file))) {
    failures.push(`${file}: font-display outside marketing, brand and editorial surfaces`)
  }
  if (PANEL.test(source) || CN_PANEL.test(source)) {
    failures.push(`${file}: rounded-xl/lg panel shell (use the surface radius token; glass cards use Card/Surface)`)
  }
  if (/text-\[1[012]px\]/.test(source)) {
    failures.push(`${file}: arbitrary micro font size (use text-2xs/text-3xs or .section-label/.meta-label)`)
  }
  return failures
}
