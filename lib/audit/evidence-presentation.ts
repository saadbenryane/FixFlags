/** Some native diagnostics include repair alternatives. Keep their exact text
 * available without presenting those alternatives as measured outcomes. */
export function includesRepairAlternatives(text: string): boolean {
  return /^\s*Fix (?:any|all) of (?:the )?following:/im.test(text)
}
