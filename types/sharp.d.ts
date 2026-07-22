declare module 'sharp' {
  const sharp: typeof import('../node_modules/sharp/lib/index')
  namespace sharp {
    type Sharp = import('../node_modules/sharp/lib/index').Sharp
    type OverlayOptions = import('../node_modules/sharp/lib/index').OverlayOptions
  }
  export default sharp
}
