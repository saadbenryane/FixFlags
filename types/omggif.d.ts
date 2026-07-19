declare module 'omggif' {
  export class GifEncoder {
    constructor(width: number, height: number)
    setDelay(ms: number): void
    setRepeat(loops: number): void
    setQuality(quality: number): void
    setTransparent(color: number | null): void
    writeHeader(): void
    addFrame(indexedData: Uint8Array): void
    finish(): void
    out: { getData(): Uint8Array }
  }
}
