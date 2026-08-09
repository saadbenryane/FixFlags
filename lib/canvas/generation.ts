import type {
  CanvasEvidenceBundle,
  CanvasGenerationResult,
  CanvasGenerator,
} from '@/lib/canvas/domain'
import { validateCanvasDocument } from '@/lib/canvas/validation'

/** Provider-neutral generation boundary. Persistence happens only after validation succeeds. */
export async function generateGroundedCanvas(input: {
  generator: CanvasGenerator
  instruction: string
  evidence: CanvasEvidenceBundle
  previous?: CanvasGenerationResult['document']
}): Promise<CanvasGenerationResult> {
  const raw = await input.generator.generate({
    instruction: input.instruction,
    evidence: input.evidence,
    previous: input.previous,
  })
  const document = validateCanvasDocument(raw, input.evidence)
  const usedIds = new Set(document.blocks.flatMap((block) => block.sourceRefIds))
  for (const block of document.blocks) {
    if (block.type === 'evidence-gallery') block.items.forEach((item) => usedIds.add(item.captureRefId))
    if (block.type === 'before-after') {
      usedIds.add(block.beforeCaptureRefId)
      usedIds.add(block.afterCaptureRefId)
    }
    if (block.type === 'product-memory') block.memoryRefIds.forEach((id) => usedIds.add(id))
  }
  return {
    document,
    sourceRefs: input.evidence.references.filter((reference) => usedIds.has(reference.id)),
  }
}

