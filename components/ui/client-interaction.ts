export function hasClientInteraction(props: object): boolean {
  return Object.entries(props).some(([name, value]) => /^on[A-Z]/.test(name) && typeof value === 'function')
}
