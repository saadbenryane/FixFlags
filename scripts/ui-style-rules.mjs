const DISPLAY_SURFACES = [
  /^app\/\(marketing\)\//,
  /^app\/opengraph-image/,
  /^app\/\(docs\)\//,
  /^components\/(?:marketing|pricing|brand|help|docs|knowledge)\//,
]

const PANEL = /className=(?:"[^"]*rounded-(xl|lg)[^"]*(?:border|bg-|shadow|\sp-\d)[^"]*"|'[^']*rounded-(xl|lg)[^']*(?:border|bg-|shadow|\sp-\d)[^']*')/
const CN_PANEL = /cn\([^)]*['"`][^'"`]*rounded-(xl|lg)[^'"`]*(?:\sborder|\sbg-)/

/** Group content with spacing, type and surface tone. Control outlines and chart geometry remain valid. */
export function separatorStyleFailures(file, source) {
  if (file.includes('/__tests__/') || /\.(?:test|spec)\./.test(file)) return []
  // DemoSite is the evaluated third-party fixture, not FixFlags product chrome.
  // Preserve its captured facts and independently defined visual design.
  if (file === 'app/demo/demo.css') return []
  const directionalClass = /(?:^|[\s"'`:])(?:border-[trblxy]|divide-[xy])(?:-(?:[1-9]\d*|\[[1-9]\d*(?:px)?\]))?(?=[\s"'`])/
  const directionalStyles = [...source.matchAll(/\bborder(?:-(?:top|right|bottom|left|block(?:-start|-end)?|inline(?:-start|-end)?)|Top|Right|Bottom|Left)\s*:\s*([^;,\n}]+)/g)]
  const visibleStyle = directionalStyles.some(([, raw]) => !/^(?:0(?:px|rem|em|%)?(?:\s|$)|none\b|hidden\b)/.test(raw.trim().replace(/^["'`]/, '')))
  const paintedSeparatorPrimitive = file === 'components/ui/separator.tsx' && /\bbg-border\b|\b[hw]-(?:px|\[1px\])/.test(source)
  return /<hr\b/i.test(source) || directionalClass.test(source) || visibleStyle || paintedSeparatorPrimitive
    ? [`${file}: visual line separator (use whitespace, typography or surface tone)`] : []
}

/** Visual conventions only. Product behavior checks remain in ui-drift-guard. */
export function uiStyleFailures(file, source) {
  const failures = separatorStyleFailures(file, source)
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
